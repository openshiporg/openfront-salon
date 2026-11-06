import { randomUUID } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { onlineDepositProvider } from "../depositCheckout";
import { deskCardSessions } from "../deskCardBoundary";
import { trustedOrigin } from "../lib/trustedOrigin";
import { serializableWorkflow } from "./serializableWorkflow";
import { completeAppointmentCheckoutTransaction } from "./completeAppointmentCheckout";
import { createProviderCheckout, expireProviderCheckout, paymentProviderFromRecord, refundProviderPayment, retrieveProviderCheckout } from "../utils/paymentProviderAdapter";

/**
 * Front-desk card payment (Boulevard / Square Appointments style): checkout prices the visit, Stripe takes the card
 * on a hosted page (opened at the desk or sent to the client's phone as a link), and the sale is recorded against the
 * Stripe PaymentIntent only after Stripe reports it paid, for exactly the priced total. Stripe TEST keys in the demo.
 */

const OPEN = ["pending", "requires_action", "authorized"];
type Data = Record<string, any>;
const dataOf = (value: unknown): Data => (value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {});

export type DeskCardInput = {
  appointmentId: string; tipAmount: number; discountAmount: number; retailItems?: unknown;
  clientPackageId?: string | null; clientMembershipId?: string | null;
};
type DeskCardState = { success: boolean; error: string | null; sessionId: string | null; url: string | null; amount: number | null; status: string | null; recorded: boolean };
const fail = (error: string): DeskCardState => ({ success: false, error, sessionId: null, url: null, amount: null, status: null, recorded: false });

function canTakeCards(context: Context) {
  return permissions.canManagePayments({ session: context.session as any });
}

/** The live card attempt for a visit, if any. */
export async function deskCardStatus(context: Context, appointmentId: string): Promise<DeskCardState> {
  if (!canTakeCards(context)) return fail("You must have payment authority");
  const latest = (await deskCardSessions(context, appointmentId))[0];
  if (!latest) return { success: true, error: null, sessionId: null, url: null, amount: null, status: null, recorded: false };
  const data = dataOf(latest.data);
  return { success: true, error: null, sessionId: latest.id, url: data.checkoutUrl || null, amount: latest.amount, status: latest.status, recorded: Boolean(data.settledSessionId) };
}

export async function startDeskCardPaymentTransaction(context: Context, input: DeskCardInput): Promise<DeskCardState> {
  if (!canTakeCards(context)) return fail("You must have payment authority");
  const sudo = context.sudo();
  const provider = await onlineDepositProvider(sudo);
  if (!provider) return fail("Card payments are not set up. Add Stripe keys to take cards.");
  // Price the visit with the same rules checkout records; nothing is written.
  const quote = await completeAppointmentCheckoutTransaction(context, { ...input, paymentMethod: "credit_card", idempotencyKey: `desk-card-quote:${randomUUID()}`, quoteOnly: true });
  if (!quote.success || quote.quoteTotal == null) return fail(quote.error || "This visit cannot be priced");
  const amount = quote.quoteTotal;
  if (amount < 50) return fail("Card payments start at $0.50. Record this visit as cash.");

  try {
    const prepared = await serializableWorkflow(context, "salon-desk-card", [`appointment:${input.appointmentId}`], async (tx) => {
      const txSudo = tx.sudo();
      for (const row of await deskCardSessions(tx, input.appointmentId)) {
        const data = dataOf(row.data);
        if (OPEN.includes(row.status) && row.amount === amount && data.checkoutUrl && (!data.expiresAt || new Date(data.expiresAt) > new Date())) {
          return { reused: true as const, id: row.id, url: data.checkoutUrl as string };
        }
        if (OPEN.includes(row.status)) throw new Error("A card payment for a different total is open. Cancel it first.");
        if (row.status === "completed" && !data.settledSessionId) throw new Error("A card payment was already taken. Record it or refund it.");
      }
      const appointment = await txSudo.query.Appointment.findOne({ where: { id: input.appointmentId }, query: "id client { user { email } guestEmail } lineItems { serviceTitle }" }) as any;
      const key = `desk-card-${randomUUID()}`;
      const created = await txSudo.query.PaymentSession.createOne({
        data: {
          provider: { connect: { id: provider.id } }, idempotencyKey: key, amount, currency: "usd", status: "pending",
          data: {
            purpose: "front_desk_card", deskAppointmentId: input.appointmentId, checkout: false, operatorId: context.session!.itemId,
            request: { tipAmount: input.tipAmount, discountAmount: input.discountAmount, retailItems: (input.retailItems || []) as any, clientPackageId: input.clientPackageId || null, clientMembershipId: input.clientMembershipId || null },
          },
        },
        query: "id",
      });
      return {
        reused: false as const, id: created.id, key,
        email: appointment?.client?.user?.email || appointment?.client?.guestEmail || null,
        title: (appointment?.lineItems || []).map((line: any) => line.serviceTitle).filter(Boolean).join(", ") || "Salon visit",
      };
    });
    if (prepared.reused) return { success: true, error: null, sessionId: prepared.id, url: prepared.url, amount, status: "pending", recorded: false };

    const back = `${trustedOrigin()}/pay?session=${encodeURIComponent(prepared.id)}`;
    let checkout;
    try {
      checkout = await createProviderCheckout({
        provider: paymentProviderFromRecord(provider as any), amount, currency: "usd", idempotencyKey: prepared.key,
        description: `${prepared.title}`.slice(0, 250), successUrl: `${back}&result=paid`, cancelUrl: `${back}&result=cancelled`,
        customerEmail: prepared.email, expiresInMinutes: 30,
        metadata: { purpose: "front_desk_card", appointmentId: input.appointmentId, deskCardSession: prepared.id },
      });
    } catch (error) {
      console.error("Desk card checkout could not be opened:", error);
      await sudo.query.PaymentSession.updateOne({ where: { id: prepared.id }, data: { status: "failed", failedAt: new Date().toISOString() }, query: "id" });
      return fail("Stripe could not open the card payment. Try again.");
    }
    const row = await sudo.query.PaymentSession.findOne({ where: { id: prepared.id }, query: "id data" });
    await sudo.query.PaymentSession.updateOne({
      where: { id: prepared.id },
      data: { providerReference: checkout.providerReference, data: { ...dataOf(row?.data), checkoutUrl: checkout.url, expiresAt: checkout.expiresAt } },
      query: "id",
    });
    return { success: true, error: null, sessionId: prepared.id, url: checkout.url, amount, status: "pending", recorded: false };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not start the card payment");
  }
}

/** Reads the card page back from Stripe; once paid, records the visit's checkout against that payment. */
export async function checkDeskCardPaymentTransaction(context: Context, sessionId: string): Promise<DeskCardState> {
  if (!canTakeCards(context)) return fail("You must have payment authority");
  const sudo = context.sudo();
  const session = await sudo.query.PaymentSession.findOne({ where: { id: sessionId }, query: "id status amount currency providerReference data provider { id code adapter config }" }) as any;
  const data = dataOf(session?.data);
  if (!session?.provider || data.purpose !== "front_desk_card" || !session.providerReference) return fail("Card payment not found");
  const appointmentId = String(data.deskAppointmentId);
  if (OPEN.includes(session.status)) {
    const observation = await retrieveProviderCheckout({ provider: paymentProviderFromRecord(session.provider), providerReference: session.providerReference });
    if (observation.status === "pending") return { success: true, error: null, sessionId, url: data.checkoutUrl || null, amount: session.amount, status: "pending", recorded: false };
    if (observation.status === "cancelled") {
      await sudo.query.PaymentSession.updateOne({ where: { id: sessionId }, data: { status: "cancelled", failedAt: new Date().toISOString() }, query: "id" });
      return { success: true, error: "The card page expired without payment.", sessionId, url: null, amount: session.amount, status: "cancelled", recorded: false };
    }
    if (observation.amount !== session.amount || (observation.currency || "").toLowerCase() !== "usd") return fail("Stripe reports a different amount. Check the payment in Stripe.");
    await sudo.query.PaymentSession.updateOne({
      where: { id: sessionId },
      data: { status: "completed", completedAt: new Date().toISOString(), data: { ...data, paymentIntent: observation.paymentIntentId } },
      query: "id",
    });
    session.status = "completed";
    data.paymentIntent = observation.paymentIntentId;
  }
  if (session.status !== "completed") return { success: true, error: null, sessionId, url: null, amount: session.amount, status: session.status, recorded: false };
  if (data.settledSessionId) return { success: true, error: null, sessionId, url: null, amount: session.amount, status: "completed", recorded: true };
  const request = dataOf(data.request);
  const recorded = await completeAppointmentCheckoutTransaction(context, {
    appointmentId, paymentMethod: "credit_card",
    tipAmount: Number(request.tipAmount || 0), discountAmount: Number(request.discountAmount || 0), retailItems: request.retailItems || [],
    clientPackageId: request.clientPackageId || null, clientMembershipId: request.clientMembershipId || null,
    idempotencyKey: `desk-card-checkout:${sessionId}`, cardSessionId: sessionId,
  });
  if (!recorded.success) return { success: false, error: `Card paid, but the sale was not recorded: ${recorded.error}`, sessionId, url: null, amount: session.amount, status: "completed", recorded: false };
  return { success: true, error: null, sessionId, url: null, amount: session.amount, status: "completed", recorded: true };
}

/** Closes an unpaid card page, or refunds a card taken but never recorded (e.g. the visit total changed). */
export async function cancelDeskCardPaymentTransaction(context: Context, sessionId: string): Promise<DeskCardState> {
  if (!canTakeCards(context)) return fail("You must have payment authority");
  const sudo = context.sudo();
  const session = await sudo.query.PaymentSession.findOne({ where: { id: sessionId }, query: "id status amount providerReference idempotencyKey data provider { id code adapter config }" }) as any;
  const data = dataOf(session?.data);
  if (!session?.provider || data.purpose !== "front_desk_card") return fail("Card payment not found");
  if (data.settledSessionId) return fail("This card payment is recorded on the sale. Refund the sale instead.");
  const provider = paymentProviderFromRecord(session.provider);
  try {
    if (OPEN.includes(session.status) && session.providerReference) {
      await expireProviderCheckout({ provider, providerReference: session.providerReference });
      const observation = await retrieveProviderCheckout({ provider, providerReference: session.providerReference });
      if (observation.status === "completed") {
        await sudo.query.PaymentSession.updateOne({ where: { id: sessionId }, data: { status: "completed", completedAt: new Date().toISOString(), data: { ...data, paymentIntent: observation.paymentIntentId } }, query: "id" });
        return fail("The client already paid. Record the payment or refund it.");
      }
      await sudo.query.PaymentSession.updateOne({ where: { id: sessionId }, data: { status: "cancelled", failedAt: new Date().toISOString() }, query: "id" });
      return { success: true, error: null, sessionId, url: null, amount: session.amount, status: "cancelled", recorded: false };
    }
    if (session.status === "completed" && typeof data.paymentIntent === "string") {
      if (!permissions.canIssueRefunds({ session: context.session as any })) return fail("You must have refund authority");
      const refund = await refundProviderPayment({ provider, providerReference: data.paymentIntent, amount: session.amount, idempotencyKey: `${session.idempotencyKey}:refund` });
      if (refund.status !== "refunded") return fail("Stripe has not finished the refund. Check again shortly.");
      await sudo.query.PaymentSession.updateOne({ where: { id: sessionId }, data: { status: "refunded", refundedAt: new Date().toISOString(), data: { ...data, refundId: String(refund.data?.refundId || "") } }, query: "id" });
      return { success: true, error: null, sessionId, url: null, amount: session.amount, status: "refunded", recorded: false };
    }
    return fail("This card payment is already closed");
  } catch (error) {
    console.error("Desk card cancel failed:", error);
    return fail("Stripe could not be reached. Try again.");
  }
}

const stateType = graphql.object<DeskCardState>()({
  name: "DeskCardPaymentResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), error: graphql.field({ type: graphql.String }),
    sessionId: graphql.field({ type: graphql.ID }), url: graphql.field({ type: graphql.String }),
    amount: graphql.field({ type: graphql.Int }), status: graphql.field({ type: graphql.String }),
    recorded: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
  },
});

export const startDeskCardPayment = graphql.field({
  type: stateType,
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    tipAmount: graphql.arg({ type: graphql.nonNull(graphql.Int) }), discountAmount: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    retailItems: graphql.arg({ type: graphql.JSON }), clientPackageId: graphql.arg({ type: graphql.ID }), clientMembershipId: graphql.arg({ type: graphql.ID }),
  },
  resolve: (_source, args, context: Context) => startDeskCardPaymentTransaction(context, args),
});
export const checkDeskCardPayment = graphql.field({
  type: stateType, args: { sessionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }) },
  resolve: (_source, { sessionId }, context: Context) => checkDeskCardPaymentTransaction(context, sessionId),
});
export const cancelDeskCardPayment = graphql.field({
  type: stateType, args: { sessionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }) },
  resolve: (_source, { sessionId }, context: Context) => cancelDeskCardPaymentTransaction(context, sessionId),
});
export const deskCardPayment = graphql.field({
  type: stateType, args: { appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }) },
  resolve: (_source, { appointmentId }, context: Context) => deskCardStatus(context, appointmentId),
});
