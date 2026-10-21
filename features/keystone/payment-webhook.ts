import { createHash } from "node:crypto";
import type { Context } from ".keystone/types";
import { canTransitionPayment, paymentRecordStatus, type PaymentLifecycleStatus } from "./payment-lifecycle";
import { parseProviderWebhook, paymentProviderFromRecord } from "./utils/paymentProviderAdapter";

export type PaymentWebhookOutcome = {
  replayed: boolean;
  processed: boolean;
  status: string;
};

export async function reconcilePaymentWebhook(
  context: Context,
  providerCode: string,
  payload: string,
  headers: Record<string, string | undefined>,
): Promise<PaymentWebhookOutcome> {
  const provider = (await context.sudo().query.PaymentProvider.findMany({
    where: { code: { equals: providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code adapter config",
  }))[0];
  if (!provider || provider.adapter !== "stripe") throw new Error("Payment webhook provider not found");

  // Signature verification happens before parsing, logging, elevation, or writes.
  const event = await parseProviderWebhook({
    provider: paymentProviderFromRecord(provider as { code: string; adapter: string; config?: unknown }),
    payload,
    headers,
  });
  if (!event.isValid || !event.eventId) throw new Error("Invalid payment webhook");

  const replayKey = `${provider.id}:${event.eventId}`;
  const payloadHash = createHash("sha256").update(payload).digest("hex");

  return context.transaction(async (transactionContext) => {
    await transactionContext.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "salon-payment-webhook",
      replayKey,
    );
    if (event.providerReference) {
      await transactionContext.prisma.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        "salon-payment-webhook-session",
        event.providerReference,
      );
    }
    const sudo = transactionContext.sudo();
    const existing = (await (sudo.query as any).PaymentWebhookEvent.findMany({
      where: { replayKey: { equals: replayKey } },
      take: 1,
      query: "id status payloadHash",
    }))[0];
    if (existing?.payloadHash !== undefined && existing.payloadHash !== payloadHash) throw new Error("Webhook replay payload does not match the original event");
    if (existing?.status === "processed") return { replayed: true, processed: true, status: existing.status };

    const sessions = event.providerReference
      ? await sudo.query.PaymentSession.findMany({
          where: {
            providerReference: { equals: event.providerReference },
            provider: { id: { equals: provider.id } },
          },
          take: 1,
          query: "id status amount currency idempotencyKey data payment { id status refundedAmount } appointment { id status }",
        })
      : [];
    const session = sessions[0];
    // Let the provider retry an early event; do not permanently acknowledge a
    // money event before its locally committed session can be reconciled.
    if (!session && event.providerReference && event.status) throw new Error("Payment session is not yet available; retry webhook");
    if (session && event.currency && event.currency.toLowerCase() !== session.currency.toLowerCase()) throw new Error("Webhook currency does not match payment session");
    if (session && event.status === "completed" && event.amount !== session.amount) throw new Error("Webhook amount does not match payment session");
    const refundTotal = session && event.status === "refunded" ? Math.max(Number(session.payment?.refundedAmount || 0), Number(event.amount || 0)) : null;
    if (refundTotal !== null && (refundTotal <= 0 || refundTotal > session.amount)) throw new Error("Webhook refund total is invalid");
    let eventStatus: "processed" | "ignored" = "ignored";
    let targetStatus = event.status;

    if (session && targetStatus) {
      if (targetStatus === "refunded" && refundTotal != null && refundTotal < session.amount) {
        targetStatus = "partially_refunded";
      }
      if (!canTransitionPayment(session.status as PaymentLifecycleStatus, targetStatus)) {
        targetStatus = null;
      }
    }

    if (session && targetStatus) {
      const now = new Date().toISOString();
      const sessionData = session.data && typeof session.data === "object" ? session.data as Record<string, any> : {};
      await sudo.query.PaymentSession.updateOne({
        where: { id: session.id },
        data: {
          status: targetStatus,
          ...(targetStatus === "completed" ? { completedAt: now } : {}),
          ...(targetStatus === "refunded" || targetStatus === "partially_refunded" ? { refundedAt: now } : {}),
          data: { ...sessionData, ...(event.data || {}), lastWebhookEventId: event.eventId },
        },
        query: "id",
      });
      if (session.payment?.id) {
        await sudo.query.Payment.updateOne({
          where: { id: session.payment.id },
          data: {
            status: paymentRecordStatus(targetStatus),
            ...(targetStatus === "completed" ? { processedAt: now } : {}),
            ...(targetStatus === "refunded" || targetStatus === "partially_refunded"
              ? { refundedAmount: refundTotal ?? session.amount, refundedAt: now }
              : {}),
          },
          query: "id",
        });
      }
      if (targetStatus === "completed" && sessionData.purpose === "gift_card" && typeof sessionData.giftCardId === "string") {
        const giftCard = await sudo.query.GiftCard.findOne({ where: { id: sessionData.giftCardId }, query: "id initialValue" });
        if (giftCard) {
          await sudo.query.GiftCard.updateOne({ where: { id: giftCard.id }, data: { isActive: true }, query: "id" });
          const purchaseKey = `${session.idempotencyKey}:purchase`;
          const purchase = (await sudo.query.GiftCardTransaction.findMany({ where: { idempotencyKey: { equals: purchaseKey } }, take: 1, query: "id" }))[0];
          if (!purchase) await sudo.query.GiftCardTransaction.createOne({
            data: { giftCard: { connect: { id: giftCard.id } }, type: "purchase", amount: giftCard.initialValue, idempotencyKey: purchaseKey, notes: `webhook:${event.eventId}` },
            query: "id",
          });
        }
      }
      if (session.appointment?.id && sessionData.purpose === "appointment_deposit") {
        if (targetStatus === "completed") {
          await sudo.query.Appointment.updateOne({ where: { id: session.appointment.id }, data: { depositPaid: true, ...(session.appointment.status === "pending" ? { status: "confirmed", confirmedAt: now } : {}) }, query: "id" });
        } else if (targetStatus === "refunded") {
          await sudo.query.Appointment.updateOne({ where: { id: session.appointment.id }, data: { depositPaid: false }, query: "id" });
        }
      }
      // A provider payment event never completes service work by itself.
      // Controlled checkout owns appointment completion and settlement facts.
      eventStatus = "processed";
    }

    const eventData = {
      provider: { connect: { id: provider.id } }, replayKey, eventId: event.eventId,
      type: event.type, providerReference: event.providerReference || "", payloadHash,
      status: eventStatus, data: event.data || {}, processedAt: new Date().toISOString(),
    };
    if (existing) await (sudo.query as any).PaymentWebhookEvent.updateOne({ where: { id: existing.id }, data: eventData, query: "id" });
    else await (sudo.query as any).PaymentWebhookEvent.createOne({ data: eventData, query: "id" });
    return { replayed: false, processed: eventStatus === "processed", status: eventStatus };
  }, { maxWait: 5_000, timeout: 30_000 });
}
