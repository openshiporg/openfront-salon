import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Context } from ".keystone/types";
import { permissions } from "./access";
import { stripeConfigured } from "../integrations/payment/stripe";
import type { CheckoutObservation } from "../integrations/payment";
import { canTransitionPayment, paymentRecordStatus, type PaymentLifecycleStatus } from "./payment-lifecycle";
import { trustedOrigin } from "./lib/trustedOrigin";
import { serializableWorkflow } from "./mutations/serializableWorkflow";
import { createProviderCheckout, paymentProviderFromRecord, retrieveProviderCheckout } from "./utils/paymentProviderAdapter";

/** Online deposits: a Stripe Checkout per appointment deposit, confirmed by reading the Checkout back from the provider. */

const OPEN_STATUSES = ["pending", "requires_action", "authorized"];

type Data = Record<string, any>;
const dataOf = (value: unknown): Data => (value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {});

/** Guests have no account, so the booking hands back an unguessable token bound to the appointment. */
export function depositAccessToken(appointmentId: string, secret = process.env.SESSION_SECRET || "") {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return createHmac("sha256", secret).update(`salon-deposit:${appointmentId}`).digest("hex");
}

export function tokenMatches(appointmentId: string, token: string | null | undefined, secret?: string) {
  if (!token || token.length !== 64) return false;
  const expected = Buffer.from(depositAccessToken(appointmentId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The installed Stripe provider, only when the server holds Stripe credentials. */
export async function onlineDepositProvider(sudo: Context) {
  if (!stripeConfigured()) return null;
  const providers = await sudo.query.PaymentProvider.findMany({
    where: { adapter: { equals: "stripe" }, isInstalled: { equals: true } },
    orderBy: { createdAt: "asc" }, take: 1, query: "id code adapter config",
  });
  return providers[0] ?? null;
}

/** Fields the booking result exposes so the storefront can offer to pay now. */
export async function bookingDepositOffer(context: Context, appointmentId: string) {
  try {
    const sudo = context.sudo();
    const appointment = await sudo.query.Appointment.findOne({ where: { id: appointmentId }, query: "id status depositAmount depositPaid" });
    const amount = Number(appointment?.depositAmount || 0);
    if (!appointment || appointment.depositPaid || amount <= 0 || !["pending", "confirmed"].includes(appointment.status || "")) return { depositAmount: null, depositAccessToken: null };
    if (!(await onlineDepositProvider(sudo))) return { depositAmount: amount, depositAccessToken: null };
    return { depositAmount: amount, depositAccessToken: depositAccessToken(appointmentId) };
  } catch (error) {
    console.error("Deposit offer unavailable:", error);
    return { depositAmount: null, depositAccessToken: null };
  }
}

async function assertAccess(context: Context, appointment: { id: string; client?: { user?: { id: string } | null } | null }, token?: string | null) {
  if (tokenMatches(appointment.id, token)) return;
  const session = context.session as any;
  if (session?.itemId) {
    if (permissions.canManageAppointments({ session }) || permissions.canManagePayments({ session })) return;
    if (appointment.client?.user?.id === session.itemId) return;
  }
  throw new Error("Appointment not found");
}

/**
 * Applies what the provider reports for a checkout to the local session, payment and appointment.
 * Amount and currency are asserted before anything is written; refunds made outside the app are observed
 * through the provider's refunded total. The same function serves the return page, staff reconcile and webhooks.
 */
export function planCheckoutSettlement(
  session: { status: string; amount: number; currency: string; refundedAmount?: number },
  observation: Pick<CheckoutObservation, "status" | "amount" | "currency" | "refundedAmount">,
): { status: PaymentLifecycleStatus; refundedAmount: number; changed: boolean } {
  const current = session.status as PaymentLifecycleStatus;
  const recorded = session.refundedAmount || 0;
  if (observation.status === "pending") return { status: current, refundedAmount: recorded, changed: false };
  if (observation.status === "cancelled") {
    return canTransitionPayment(current, "cancelled") && current !== "cancelled"
      ? { status: "cancelled", refundedAmount: recorded, changed: true }
      : { status: current, refundedAmount: recorded, changed: false };
  }
  if (observation.amount !== session.amount) throw new Error("The amount paid does not match the deposit. Contact the salon.");
  if ((observation.currency || "").toLowerCase() !== session.currency.toLowerCase()) throw new Error("The currency paid does not match the deposit. Contact the salon.");
  const refunded = Math.max(recorded, Math.min(observation.refundedAmount || 0, session.amount));
  let status: PaymentLifecycleStatus = current;
  if (current === "pending" || current === "requires_action" || current === "authorized") status = "completed";
  if (refunded > 0 && (status === "completed" || status === "partially_refunded")) status = refunded >= session.amount ? "refunded" : "partially_refunded";
  if (!canTransitionPayment(current, status) && status !== current) status = current;
  return { status, refundedAmount: refunded, changed: status !== current || refunded !== recorded };
}

export async function applyObservation(sudo: Context, session: any, observation: CheckoutObservation) {
  const plan = planCheckoutSettlement({ status: session.status, amount: session.amount, currency: session.currency, refundedAmount: session.payment?.refundedAmount || 0 }, observation);
  if (!plan.changed) return plan;
  const now = new Date().toISOString();
  const refunded = plan.status === "refunded" || plan.status === "partially_refunded";
  await sudo.query.PaymentSession.updateOne({
    where: { id: session.id },
    data: {
      status: plan.status,
      ...(plan.status === "completed" || session.status === "pending" && refunded ? { completedAt: now } : {}),
      ...(plan.status === "cancelled" ? { failedAt: now } : {}),
      ...(refunded ? { refundedAt: now } : {}),
      data: { ...dataOf(session.data), paymentIntent: observation.paymentIntentId, observedRefunded: plan.refundedAmount, lastObservedAt: now },
    },
    query: "id",
  });
  if (session.payment?.id) {
    await sudo.query.Payment.updateOne({
      where: { id: session.payment.id },
      data: {
        status: paymentRecordStatus(plan.status),
        ...(session.payment.status !== "completed" && plan.status !== "cancelled" ? { processedAt: now } : {}),
        ...(refunded ? { refundedAmount: plan.refundedAmount, refundedAt: now } : {}),
      },
      query: "id",
    });
  }
  const appointment = session.appointment;
  if (appointment?.id && !appointment.transaction?.id) {
    if (plan.status === "completed" || refunded) {
      await sudo.query.Appointment.updateOne({
        where: { id: appointment.id },
        data: { depositPaid: plan.refundedAmount < session.amount, ...(appointment.status === "pending" && plan.status === "completed" ? { status: "confirmed", confirmedAt: now } : {}) },
        query: "id",
      });
    }
  }
  return plan;
}

export const SESSION_QUERY = "id amount currency status providerReference idempotencyKey data provider { id code adapter config } payment { id status refundedAmount } appointment { id status transaction { id } client { user { id } } }";

/** Opens (or reuses) a Stripe Checkout for the appointment's deposit and returns its URL. */
export async function startDepositCheckoutTransaction(context: Context, args: { appointmentId: string; accessToken?: string | null }) {
  try {
    const prepared = await serializableWorkflow(context, "salon-deposit-checkout", [`appointment:${args.appointmentId}`], async (tx) => {
      const sudo = tx.sudo();
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status depositAmount depositPaid services { name } client { user { id email } guestEmail }",
      }) as any;
      if (!appointment) throw new Error("Appointment not found");
      await assertAccess(tx, appointment, args.accessToken);
      if (!["pending", "confirmed"].includes(appointment.status || "") || appointment.depositPaid) throw new Error("This visit has no deposit to pay.");
      const amount = Number(appointment.depositAmount || 0);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("This visit has no deposit to pay.");
      const provider = await onlineDepositProvider(sudo);
      if (!provider) throw new Error("Online deposits are not available. Pay the deposit at the salon.");

      const open = await sudo.query.PaymentSession.findMany({
        where: { appointment: { id: { equals: appointment.id } }, status: { in: OPEN_STATUSES as any } }, take: 50,
        query: "id status amount data provider { id }",
      });
      const deposits = open.filter((row: any) => dataOf(row.data).purpose === "appointment_deposit");
      const reusable = deposits.find((row: any) => row.provider?.id === provider.id && row.amount === amount && dataOf(row.data).checkoutUrl && (!dataOf(row.data).expiresAt || new Date(dataOf(row.data).expiresAt) > new Date()));
      if (reusable) return { url: dataOf(reusable.data).checkoutUrl as string, reused: true as const };
      if (deposits.length) throw new Error("A deposit attempt is already open. Check its status before paying again.");

      const key = `deposit-${randomUUID()}`;
      const created = await sudo.query.PaymentSession.createOne({
        data: {
          appointment: { connect: { id: appointment.id } }, provider: { connect: { id: provider.id } },
          idempotencyKey: key, amount, currency: "usd", status: "pending",
          data: { purpose: "appointment_deposit", checkout: true },
        },
        query: "id",
      });
      const payment = await sudo.query.Payment.createOne({
        data: {
          subtotal: amount, tax: 0, tip: 0, discount: 0, totalAmount: amount, paymentMethod: "credit_card", status: "pending",
          session: { connect: { id: created.id } },
          receiptEmail: appointment.client?.user?.email || appointment.client?.guestEmail || "", notes: `Online appointment deposit for ${appointment.id}`,
        },
        query: "id",
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: created.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
      return {
        reused: false as const, sessionId: created.id, key, amount, provider, appointmentId: appointment.id,
        email: appointment.client?.user?.email || appointment.client?.guestEmail || null,
        title: (appointment.services || []).map((service: any) => service.name).filter(Boolean).join(", ") || "Appointment",
      };
    });
    if (prepared.reused) return { success: true, error: null, url: prepared.url };

    // The provider call happens outside the database transaction, under the persisted idempotency key.
    const origin = trustedOrigin();
    const back = `${origin}/booking/deposit?id=${encodeURIComponent(prepared.appointmentId)}&token=${depositAccessToken(prepared.appointmentId)}`;
    let checkout;
    try {
      checkout = await createProviderCheckout({
        provider: paymentProviderFromRecord(prepared.provider as any),
        amount: prepared.amount, currency: "usd", idempotencyKey: prepared.key,
        description: `Deposit · ${prepared.title}`.slice(0, 250),
        successUrl: `${back}&result=return`, cancelUrl: `${back}&result=cancelled`,
        customerEmail: prepared.email, metadata: { purpose: "appointment_deposit", appointmentId: prepared.appointmentId, depositKey: prepared.key },
      });
    } catch (error) {
      console.error("Deposit checkout could not be opened:", error);
      await context.sudo().query.PaymentSession.updateOne({ where: { id: prepared.sessionId }, data: { status: "failed", failedAt: new Date().toISOString() }, query: "id" });
      throw new Error("Online deposits are unavailable right now. Pay the deposit at the salon.");
    }
    const sudo = context.sudo();
    const row = await sudo.query.PaymentSession.findOne({ where: { id: prepared.sessionId }, query: "id data" });
    await sudo.query.PaymentSession.updateOne({
      where: { id: prepared.sessionId },
      data: { providerReference: checkout.providerReference, data: { ...dataOf(row?.data), checkoutUrl: checkout.url, expiresAt: checkout.expiresAt } },
      query: "id",
    });
    return { success: true, error: null, url: checkout.url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to open the deposit checkout.", url: null };
  }
}

/** Reads the checkout back from the provider (payment status and refunds) and settles the deposit. */
export async function confirmDepositCheckoutTransaction(context: Context, args: { appointmentId: string; accessToken?: string | null }) {
  try {
    const appointment = await context.sudo().query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id status depositPaid client { user { id } }" }) as any;
    if (!appointment) throw new Error("Appointment not found");
    await assertAccess(context, appointment, args.accessToken);
    const sessions = await context.sudo().query.PaymentSession.findMany({
      where: { appointment: { id: { equals: appointment.id } }, status: { in: [...OPEN_STATUSES, "completed", "partially_refunded"] as any } },
      orderBy: { createdAt: "desc" }, take: 20, query: SESSION_QUERY,
    });
    const target = sessions.find((row: any) => dataOf(row.data).purpose === "appointment_deposit" && dataOf(row.data).checkout && row.providerReference);
    if (!target?.provider) return { success: true, error: null, paid: Boolean(appointment.depositPaid), status: appointment.depositPaid ? "completed" : null };
    const observation = await retrieveProviderCheckout({ provider: paymentProviderFromRecord(target.provider as any), providerReference: target.providerReference });
    const plan = await serializableWorkflow(context, "salon-deposit-checkout", [`appointment:${appointment.id}`], async (tx) => {
      const sudo = tx.sudo();
      const fresh = await sudo.query.PaymentSession.findOne({ where: { id: target.id }, query: SESSION_QUERY });
      return applyObservation(sudo, fresh, observation);
    });
    return { success: true, error: null, paid: plan.status === "completed" || plan.status === "partially_refunded", status: plan.status };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to check the deposit.", paid: false, status: null };
  }
}

/** Staff reconcile: reads one deposit session back from the provider and settles it. */
export async function reconcileDepositSessionTransaction(context: Context, paymentSessionId: string) {
  const session = await context.sudo().query.PaymentSession.findOne({ where: { id: paymentSessionId }, query: SESSION_QUERY }) as any;
  if (!session?.provider || dataOf(session.data).purpose !== "appointment_deposit" || !dataOf(session.data).checkout || !session.providerReference) throw new Error("Payment session not found");
  const observation = await retrieveProviderCheckout({ provider: paymentProviderFromRecord(session.provider), providerReference: session.providerReference });
  return serializableWorkflow(context, "salon-deposit-checkout", [`appointment:${session.appointment?.id || session.id}`], async (tx) => {
    const sudo = tx.sudo();
    return applyObservation(sudo, await sudo.query.PaymentSession.findOne({ where: { id: session.id }, query: SESSION_QUERY }), observation);
  });
}
