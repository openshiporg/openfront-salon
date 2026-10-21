import { createHash } from "node:crypto";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { currentStockContext } from "../inventory/locationAuthority";
import { serializableWorkflow } from "./serializableWorkflow";
import { refundProviderPayment, paymentProviderFromRecord } from "../utils/paymentProviderAdapter";

/** Persist the request BEFORE a provider call. A timeout never invents a refund. */
export async function refundAppointmentDeposit(context: Context, input: { paymentSessionId: string; amount?: number | null; reason?: string | null; idempotencyKey?: string | null }) {
  const denied = { success: false, refundId: null, status: null };
  if (!permissions.canIssueRefunds({ session: context.session as any })) return { ...denied, error: "You must have refund authority" };
  if (!input.idempotencyKey || input.idempotencyKey.length < 12 || input.idempotencyKey.length > 160 || !input.reason?.trim()) return { ...denied, error: "A unique refund operation key and reason are required" };
  const key = createHash("sha256").update(input.idempotencyKey).digest("hex");
  try {
    const prepared: any = await serializableWorkflow(context, "salon-domain-resource", [`deposit:${input.paymentSessionId}`], async tx => {
      // Cookie role flags are not refund authority: re-read the actor's current role in this
      // preparation attempt before any sudo read, prepared-operation replay or write.
      const current = await currentStockContext(tx, "return");
      const sudo = current.sudo();
      const session = await sudo.query.PaymentSession.findOne({ where: { id: input.paymentSessionId }, query: "id amount status providerReference data provider { id code adapter config } payment { id status refundedAmount } appointment { id transaction { id } }" });
      if (!session?.payment || !session.provider || (session.data as any)?.purpose !== "appointment_deposit") throw new Error("Deposit payment not found");
      if (session.appointment?.transaction?.id) throw new Error("Use the sale reversal workflow after a deposit has been applied");
      const data = session.data as any, operations = { ...(data.refundOperations || {}) };
      const existing = operations[key];
      if (existing) {
        if ((input.amount != null && existing.amount !== input.amount) || existing.reason !== input.reason!.trim()) throw new Error("Refund key was reused with different input");
        return { session, operation: existing, key };
      }
      if (Object.values(operations).some((operation: any) => !["completed", "failed"].includes(operation.status))) throw new Error("An earlier refund requires reconciliation before another refund");
      if (!["completed", "partially_refunded"].includes(session.payment.status)) throw new Error("Deposit is not refundable");
      const baseRefunded = Number(session.payment.refundedAmount || 0), amount = input.amount ?? session.amount - baseRefunded;
      if (!Number.isSafeInteger(amount) || amount <= 0 || baseRefunded + amount > session.amount) throw new Error("Invalid refund amount");
      const operation = { amount, baseRefunded, reason: input.reason!.trim(), status: "prepared", actorId: context.session!.itemId, createdAt: new Date().toISOString() };
      operations[key] = operation;
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { data: { ...data, refundOperations: operations } }, query: "id" });
      return { session, operation, key };
    });
    if (prepared.operation.status === "completed") return { success: true, refundId: prepared.operation.refundId || null, status: prepared.operation.resultStatus, error: null };
    // Outside the DB transaction. Retrying prepared/unknown uses the SAME provider key.
    const result = await refundProviderPayment({ provider: paymentProviderFromRecord(prepared.session.provider), providerReference: prepared.session.providerReference, amount: prepared.operation.amount, refundId: prepared.operation.refundId || undefined, idempotencyKey: `deposit-refund:${prepared.session.id}:${key}` });
    return await serializableWorkflow(context, "salon-domain-resource", [`deposit:${input.paymentSessionId}`], async tx => {
      const current = await currentStockContext(tx, "return");
      const sudo = current.sudo();
      const session = await sudo.query.PaymentSession.findOne({ where: { id: input.paymentSessionId }, query: "id amount data payment { id refundedAmount } appointment { id }" });
      const data = session!.data as any, operation = data.refundOperations?.[key];
      if (!operation) throw new Error("Refund operation evidence is missing");
      if (operation.status === "completed") return { success: true, refundId: operation.refundId || null, status: operation.resultStatus, error: null };
      const completed = result.status === "refunded" || result.status === "completed";
      if (completed && result.amount != null && result.amount !== operation.amount) throw new Error("Provider refund amount does not match the reserved operation; reconciliation required");
      const refunded = Math.max(Number(session!.payment!.refundedAmount || 0), operation.baseRefunded + operation.amount);
      const status = refunded === session!.amount ? "refunded" : "partially_refunded";
      const now = new Date().toISOString();
      const next = { ...operation, status: completed ? "completed" : result.status === "failed" ? "failed" : "pending", resultStatus: completed ? status : result.status, refundId: result.data?.refundId || null, updatedAt: now };
      await sudo.query.PaymentSession.updateOne({ where: { id: session!.id }, data: { ...(completed ? { status, refundedAt: now } : {}), data: { ...data, refundOperations: { ...data.refundOperations, [key]: next } } }, query: "id" });
      if (completed) {
        await sudo.query.Payment.updateOne({ where: { id: session!.payment!.id }, data: { status, refundedAmount: refunded, refundReason: operation.reason, refundedAt: now }, query: "id" });
        if (session!.appointment?.id) await sudo.query.Appointment.updateOne({ where: { id: session!.appointment.id }, data: { depositPaid: refunded < session!.amount }, query: "id" });
      }
      return { success: completed, refundId: typeof result.data?.refundId === "string" ? result.data.refundId : null, status: completed ? status : result.status, error: completed ? null : "Refund is not completed; reconcile the same operation before retrying" };
    });
  } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Refund failed; retry only with the same operation key" }; }
}
