import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Context } from ".keystone/types";
import { onlineDepositProvider } from "./depositCheckout";
import { trustedOrigin } from "./lib/trustedOrigin";
import { serializableWorkflow } from "./mutations/serializableWorkflow";
import {
  cancelProviderSubscription,
  cancelProviderSubscriptionAndRefund,
  createProviderSubscriptionCheckout,
  paymentProviderFromRecord,
  retrieveProviderSubscriptionCheckout,
  setProviderSubscriptionPaused,
} from "./utils/paymentProviderAdapter";

/**
 * Online memberships (Mindbody / Boulevard style autopay): a signed-in client joins a plan on Stripe's hosted
 * subscription page. The membership is created only after Stripe confirms the first month, each later month is
 * recorded from Stripe's invoice.paid webhook, and cancelling in the dashboard stops the renewal at period end.
 */

type Data = Record<string, any>;
const dataOf = (value: unknown): Data => (value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : {});

function token(sessionId: string) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return createHmac("sha256", secret).update(`salon-membership:${sessionId}`).digest("hex");
}
export function tokenOk(sessionId: string, value?: string | null) {
  if (!value || value.length !== 64) return false;
  const a = Buffer.from(token(sessionId)); const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type StartResult = { success: boolean; error: string | null; url: string | null };
export type StatusResult = { success: boolean; error: string | null; status: string | null; planName: string | null; amount: number | null; nextBillingDate: string | null };
const startFail = (error: string): StartResult => ({ success: false, error, url: null });

export async function startMembershipCheckoutTransaction(context: Context, args: { membershipId: string }): Promise<StartResult> {
  const userId = context.session?.itemId;
  if (!userId) return startFail("Sign in to join a membership.");
  const sudo = context.sudo();
  const [user, plan] = await Promise.all([
    sudo.query.User.findOne({ where: { id: userId }, query: "id email name" }),
    sudo.query.Membership.findOne({ where: { id: args.membershipId }, query: "id name monthlyPrice isActive" }),
  ]);
  if (!user?.email) return startFail("Sign in to join a membership.");
  if (!plan?.isActive || !(Number(plan.monthlyPrice) > 0)) return startFail("That membership isn't offered right now.");
  const current = await sudo.query.ClientMembership.count({ where: { client: { id: { equals: user.id } }, membership: { id: { equals: plan.id } }, status: { in: ["active", "paused"] } } });
  if (current) return startFail("You already have this membership. Manage it from your account.");
  const provider = await onlineDepositProvider(sudo);
  if (!provider) return startFail("Online sign-up is unavailable right now. Ask at the salon.");
  const key = `membership-online-${randomUUID()}`;
  const session = await sudo.query.PaymentSession.createOne({
    data: {
      provider: { connect: { id: provider.id } }, idempotencyKey: key, amount: Number(plan.monthlyPrice), currency: "usd", status: "pending",
      data: { purpose: "membership", online: true, membershipId: plan.id, userId: user.id },
    },
    query: "id",
  });
  const back = `${trustedOrigin()}/memberships/joined?id=${encodeURIComponent(session.id)}&token=${token(session.id)}`;
  try {
    const checkout = await createProviderSubscriptionCheckout({
      provider: paymentProviderFromRecord(provider as any), amount: Number(plan.monthlyPrice), currency: "usd", interval: "month", idempotencyKey: key,
      description: `${plan.name} membership`, successUrl: back, cancelUrl: `${back}&result=cancelled`, customerEmail: user.email,
      metadata: { purpose: "membership", membershipSession: session.id, membershipId: plan.id },
    });
    await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { providerReference: checkout.providerReference, data: { purpose: "membership", online: true, membershipId: plan.id, userId: user.id, checkout: true, checkoutUrl: checkout.url } }, query: "id" });
    return { success: true, error: null, url: checkout.url };
  } catch (error) {
    console.error("Membership checkout could not be opened:", error);
    await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "failed", failedAt: new Date().toISOString() }, query: "id" });
    return startFail("Online sign-up is unavailable right now. Ask at the salon.");
  }
}

/** Reads the subscription checkout from Stripe and creates the membership once. Safe to repeat (return page + webhook). */
export async function settleOnlineMembership(context: Context, sessionId: string): Promise<StatusResult> {
  const sudo = context.sudo();
  const session = await sudo.query.PaymentSession.findOne({ where: { id: sessionId }, query: "id status amount providerReference data provider { id code adapter config }" }) as any;
  const data = dataOf(session?.data);
  if (!session?.provider || data.purpose !== "membership" || !data.online || !session.providerReference) throw new Error("Membership sign-up not found");
  const plan = await sudo.query.Membership.findOne({ where: { id: data.membershipId }, query: "id name" });
  const result = (status: string, nextBillingDate: string | null = null): StatusResult => ({ success: true, error: null, status, planName: plan?.name || null, amount: session.amount, nextBillingDate });
  if (data.clientMembershipId) {
    const existing = await sudo.query.ClientMembership.findOne({ where: { id: data.clientMembershipId }, query: "nextBillingDate" });
    return result("completed", existing?.nextBillingDate || null);
  }
  if (["cancelled", "failed"].includes(session.status)) return result(session.status);
  const observation = await retrieveProviderSubscriptionCheckout({ provider: paymentProviderFromRecord(session.provider), providerReference: session.providerReference });
  if (observation.status === "pending") return result("pending");
  if (observation.status === "cancelled") {
    await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "cancelled", failedAt: new Date().toISOString() }, query: "id" });
    return result("cancelled");
  }
  if (observation.amount !== session.amount || (observation.currency || "").toLowerCase() !== "usd" || !observation.subscriptionId) throw new Error("Stripe reports a different amount. Contact the salon.");
  const next = observation.currentPeriodEnd || new Date(Date.now() + 30 * 86_400_000).toISOString();
  await serializableWorkflow(context, "salon-benefit-sale", [`membership-online:${session.id}`, `client:${data.userId}`], async (tx) => {
    const txSudo = tx.sudo();
    const fresh = await txSudo.query.PaymentSession.findOne({ where: { id: session.id }, query: "id data" });
    if (dataOf(fresh?.data).clientMembershipId) return;
    const now = new Date().toISOString();
    const membership = await txSudo.query.ClientMembership.createOne({
      data: { client: { connect: { id: data.userId } }, membership: { connect: { id: data.membershipId } }, startDate: now, nextBillingDate: next, status: "active", providerSubscriptionId: observation.subscriptionId! },
      query: "id",
    });
    const user = await txSudo.query.User.findOne({ where: { id: data.userId }, query: "email" });
    const payment = await txSudo.query.Payment.createOne({
      data: { subtotal: session.amount, tax: 0, tip: 0, discount: 0, totalAmount: session.amount, paymentMethod: "credit_card", status: "completed", processedAt: now, receiptEmail: user?.email || "", notes: `membership-online:${session.id}`, session: { connect: { id: session.id } } },
      query: "id",
    });
    await txSudo.query.PaymentSession.updateOne({
      where: { id: session.id },
      data: { status: "completed", completedAt: now, payment: { connect: { id: payment.id } }, data: { ...dataOf(fresh?.data), clientMembershipId: membership.id, subscriptionId: observation.subscriptionId } },
      query: "id",
    });
  });
  return result("completed", next);
}

/** Stripe billed the next month: record it as a membership payment and move the renewal date. */
export async function recordMembershipRenewal(context: Context, input: { subscriptionId: string; invoiceId: string; amount: number; periodEnd: string | null }) {
  const sudo = context.sudo();
  const membership = (await sudo.query.ClientMembership.findMany({ where: { providerSubscriptionId: { equals: input.subscriptionId } }, take: 1, query: "id status client { email }" }))[0];
  if (!membership) return false;
  const note = `membership-renewal:${input.invoiceId}`;
  const seen = await sudo.query.Payment.count({ where: { notes: { equals: note } } });
  if (seen) return false;
  const now = new Date().toISOString();
  await sudo.query.Payment.createOne({ data: { subtotal: input.amount, tax: 0, tip: 0, discount: 0, totalAmount: input.amount, paymentMethod: "credit_card", status: "completed", processedAt: now, receiptEmail: membership.client?.email || "", notes: note }, query: "id" });
  if (input.periodEnd) await sudo.query.ClientMembership.updateOne({ where: { id: membership.id }, data: { nextBillingDate: input.periodEnd }, query: "id" });
  return true;
}

/** When the salon cancels an online membership, Stripe stops billing at the end of the paid month. */
export async function syncMembershipBilling(context: Context, clientMembershipId: string, status: "active" | "paused" | "cancelled") {
  const sudo = context.sudo();
  const membership = await sudo.query.ClientMembership.findOne({ where: { id: clientMembershipId }, query: "providerSubscriptionId" });
  if (!membership?.providerSubscriptionId) return;
  const provider = await onlineDepositProvider(sudo);
  if (!provider) throw new Error("Stripe isn't connected, so this online membership's billing can't be changed. Change it in Stripe.");
  const config = paymentProviderFromRecord(provider as any);
  if (status === "cancelled") await cancelProviderSubscription({ provider: config, subscriptionId: membership.providerSubscriptionId });
  else await setProviderSubscriptionPaused({ provider: config, subscriptionId: membership.providerSubscriptionId, paused: status === "paused" });
}


/**
 * Cancel and refund (Mindbody / Square): ends an online membership today, stops Stripe billing now, and
 * refunds the latest month back to the card. The matching salon Payment is marked refunded.
 */
export async function cancelAndRefundMembership(context: Context, clientMembershipId: string) {
  const sudo = context.sudo();
  const membership = await sudo.query.ClientMembership.findOne({ where: { id: clientMembershipId }, query: "id status providerSubscriptionId" });
  if (!membership) throw new Error("Membership not found");
  if (!membership.providerSubscriptionId) throw new Error("Only memberships bought online can be refunded here. Refund an in-salon sale from Sales & refunds.");
  const provider = await onlineDepositProvider(sudo);
  if (!provider) throw new Error("Stripe isn't connected, so this membership can't be refunded here. Refund it in Stripe.");
  const refund = await cancelProviderSubscriptionAndRefund({ provider: paymentProviderFromRecord(provider as any), subscriptionId: membership.providerSubscriptionId, idempotencyKey: `membership-refund:${membership.id}` });
  const now = new Date().toISOString();
  await sudo.query.ClientMembership.updateOne({ where: { id: membership.id }, data: { status: "cancelled", pausedUntil: null, nextBillingDate: null }, query: "id" });
  if (refund.amount > 0) {
    // The latest month: the newest renewal if there is one, otherwise the sign-up payment.
    const signup = await sudo.prisma.paymentSession.findFirst({ where: { data: { path: ["clientMembershipId"], equals: membership.id } }, select: { id: true, payment: { select: { id: true } } } });
    const sessions = signup ? [signup] : [];
    const signupPaymentId = signup?.payment?.id || null;
    const target = signupPaymentId
      ? await sudo.query.Payment.findOne({ where: { id: signupPaymentId }, query: "id status totalAmount" })
      : null;
    if (target && target.status === "completed") {
      await sudo.query.Payment.updateOne({ where: { id: target.id }, data: { status: refund.amount >= Number(target.totalAmount) ? "refunded" : "partially_refunded", refundedAmount: refund.amount, refundedAt: now, refundReason: "Membership cancelled and refunded", stripeRefundId: refund.refundId || "" }, query: "id" });
    }
    if (sessions[0]?.id) await sudo.query.PaymentSession.updateOne({ where: { id: sessions[0].id }, data: { status: "refunded" }, query: "id" }).catch(() => undefined);
  }
  return refund;
}
