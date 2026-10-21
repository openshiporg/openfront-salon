import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { isPolicyDeadlineOpen } from "../bookingPolicy";
import { paymentRecordStatus } from "../payment-lifecycle";
import { createProviderPaymentSession, paymentProviderFromRecord } from "../utils/paymentProviderAdapter";
import { serializableWorkflow } from "./serializableWorkflow";

type AppointmentTransition = "confirmed" | "in_progress" | "cancelled" | "no_show";
type WorkflowResult = { success: boolean; appointmentId: string | null; status: string | null; error: string | null };

const transitions: Record<string, AppointmentTransition[]> = {
  pending: ["confirmed", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["cancelled"],
};

function isOperator(context: Context) {
  return permissions.canManageAppointments({ session: context.session as any });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Appointment workflow failed";
}

function assertEffectiveClientPolicy(snapshot: any, action: "cancellation" | "reschedule") {
  const now = Date.now();
  if (!snapshot?.version || !snapshot?.effectiveFrom) throw new Error(`Online ${action} requires an accepted effective policy snapshot`);
  if (snapshot.revokedAt) throw new Error(`Online ${action} policy has been revoked; contact the salon`);
  if (new Date(snapshot.effectiveFrom).getTime() > now || (snapshot.effectiveUntil && new Date(snapshot.effectiveUntil).getTime() <= now)) {
    throw new Error(`Online ${action} policy is not currently effective; contact the salon`);
  }
  const deadline = snapshot[`${action}Deadline`];
  if (!isPolicyDeadlineOpen(deadline, now)) throw new Error(`Online ${action} is outside the accepted policy window; contact the salon`);
}

export async function transitionAppointmentTransaction(
  context: Context,
  args: { appointmentId: string; status: AppointmentTransition; reason?: string | null },
): Promise<WorkflowResult> {
  const reason = args.reason?.trim() || "";
  if (!context.session?.itemId) return { success: false, appointmentId: null, status: null, error: "You must be signed in" };
  if (!(args.status in { confirmed: 1, in_progress: 1, cancelled: 1, no_show: 1 })) {
    return { success: false, appointmentId: null, status: null, error: "Unsupported appointment transition" };
  }
  if (reason.length > 1_000) return { success: false, appointmentId: null, status: null, error: "Transition reason is too long" };
  if (args.status === "cancelled" && !reason) return { success: false, appointmentId: null, status: null, error: "A cancellation reason is required" };

  try {
    return await serializableWorkflow(context, "salon-appointment-transition", [`appointment:${args.appointmentId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status metadata client { user { id } } payment { id status refundedAmount totalAmount } transaction { id }",
      });
      if (!appointment) throw new Error("Appointment not found");
      const operator = isOperator(context);
      const owner = appointment.client?.user?.id === context.session!.itemId;
      if (!operator && !(owner && args.status === "cancelled")) throw new Error("You cannot transition this appointment");
      const metadata = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata as Record<string, any> : {};
      if (owner && !operator && args.status === "cancelled") assertEffectiveClientPolicy(metadata.clientPolicySnapshot, "cancellation");
      if (appointment.status === args.status) {
        return { success: true, appointmentId: appointment.id, status: appointment.status, error: null };
      }
      if (!(transitions[appointment.status || ""] || []).includes(args.status)) {
        throw new Error(`Cannot transition appointment from ${appointment.status || "unknown"} to ${args.status}`);
      }
      if (args.status === "in_progress" && appointment.transaction?.id) throw new Error("Checked-out appointments cannot be restarted");

      const now = new Date().toISOString();
      const history = Array.isArray(metadata.transitionHistory) ? metadata.transitionHistory.slice(-49) : [];
      const data: Record<string, any> = {
        status: args.status,
        metadata: {
          ...metadata,
          transitionHistory: [...history, {
            from: appointment.status,
            to: args.status,
            reason: reason || null,
            actorId: context.session!.itemId,
            at: now,
          }],
        },
      };
      if (args.status === "confirmed") data.confirmedAt = now;
      if (args.status === "cancelled") {
        data.cancelledAt = now;
        data.cancellationReason = reason;
      }
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data, query: "id" });
      if (["cancelled", "no_show"].includes(args.status)) {
        const segments = await (sudo.query as any).AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["planned", "started"] } }, take: 200, query: "id" });
        for (const segment of segments) await (sudo.query as any).AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "skipped" }, query: "id" });
      }
      return { success: true, appointmentId: appointment.id, status: args.status, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, status: null, error: errorMessage(error) };
  }
}

const transitionResult = graphql.object<WorkflowResult>()({
  name: "TransitionAppointmentResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    appointmentId: graphql.field({ type: graphql.ID }),
    status: graphql.field({ type: graphql.String }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const transitionAppointment = graphql.field({
  type: transitionResult,
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    status: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    reason: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) {
    return transitionAppointmentTransaction(context, args as { appointmentId: string; status: AppointmentTransition; reason?: string | null });
  },
});

type DepositResult = {
  success: boolean; appointmentId: string | null; paymentId: string | null;
  paymentSessionId: string | null; status: string | null; error: string | null;
};

export async function processAppointmentDepositTransaction(
  context: Context,
  args: { appointmentId: string; paymentMethod: string; providerCode?: string | null; idempotencyKey: string },
): Promise<DepositResult> {
  if (!isOperator(context)) return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "You must be an authorized salon operator" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12 || args.idempotencyKey.length > 200) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "Idempotency key is invalid" };
  }
  if (!new Set(["credit_card", "debit_card", "cash", "apple_pay", "google_pay"]).has(args.paymentMethod)) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "Payment method is invalid" };
  }

  try {
    // Match checkout's appointment lock so a deposit cannot be created across settlement.
    return await serializableWorkflow(context, "salon-domain-resource", [
      `appointment:${args.appointmentId}`,
      `idempotency:${args.idempotencyKey}`,
    ], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1,
        query: "id amount status data appointment { id } payment { id }",
      }))[0];
      if (existing) {
        const data = existing.data && typeof existing.data === "object" ? existing.data as Record<string, any> : {};
        if (existing.appointment?.id !== args.appointmentId || data.purpose !== "appointment_deposit") {
          throw new Error("Idempotency key was already used for another operation");
        }
        return { success: true, appointmentId: args.appointmentId, paymentId: existing.payment?.id || null, paymentSessionId: existing.id, status: existing.status, error: null };
      }

      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status depositAmount depositPaid client { user { email } }",
      });
      if (!appointment) throw new Error("Appointment not found");
      if (!new Set(["pending", "confirmed"]).has(appointment.status || "")) throw new Error("Appointment is not eligible for a deposit");
      if (appointment.depositPaid) throw new Error("Appointment deposit is already paid");
      const pendingSessions = await sudo.query.PaymentSession.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["pending", "requires_action", "authorized"] } }, take: 100, query: "id data" });
      if (pendingSessions.some((session: any) => session.data?.purpose === "appointment_deposit")) throw new Error("Reconcile the existing deposit attempt before collecting another");
      const amount = Number(appointment.depositAmount || 0);
      if (!Number.isInteger(amount) || amount <= 0) throw new Error("Appointment does not require a deposit");

      const providers = await sudo.query.PaymentProvider.findMany({
        where: args.providerCode
          ? { code: { equals: args.providerCode }, isInstalled: { equals: true } }
          : { isInstalled: { equals: true }, isDefault: { equals: true } },
        take: 1,
        query: "id code adapter config",
      });
      const provider = providers[0];
      if (!provider) throw new Error("Payment provider is unavailable");
      if (provider.adapter !== "manual") throw new Error("Integrated online deposit collection is not available; record an externally collected deposit with the manual provider");
      const result = await createProviderPaymentSession({
        provider: paymentProviderFromRecord(provider as { code: string; adapter: string; config?: unknown }),
        amount,
        currency: "usd",
        idempotencyKey: args.idempotencyKey,
        metadata: { purpose: "appointment_deposit", appointmentId: appointment.id, operatorId: context.session!.itemId },
      });
      const now = new Date().toISOString();
      const session = await sudo.query.PaymentSession.createOne({
        data: {
          appointment: { connect: { id: appointment.id } }, provider: { connect: { id: provider.id } },
          idempotencyKey: args.idempotencyKey, amount, currency: "usd", status: result.status,
          providerReference: result.providerReference,
          completedAt: result.status === "completed" ? now : undefined,
          data: { ...(result.data || {}), purpose: "appointment_deposit", clientSecret: result.clientSecret || null },
        },
        query: "id",
      });
      const payment = await sudo.query.Payment.createOne({
        data: {
          subtotal: amount, tax: 0, tip: 0, discount: 0, totalAmount: amount,
          paymentMethod: args.paymentMethod, status: paymentRecordStatus(result.status),
          session: { connect: { id: session.id } }, processedBy: { connect: { id: context.session!.itemId } },
          processedAt: result.status === "completed" ? now : undefined,
          receiptEmail: appointment.client?.user?.email || "", notes: `Appointment deposit for ${appointment.id}`,
        },
        query: "id",
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
      if (result.status === "completed") {
        await sudo.query.Appointment.updateOne({
          where: { id: appointment.id },
          data: { depositPaid: true, ...(appointment.status === "pending" ? { status: "confirmed", confirmedAt: now } : {}) },
          query: "id",
        });
      }
      return { success: true, appointmentId: appointment.id, paymentId: payment.id, paymentSessionId: session.id, status: result.status, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: errorMessage(error) };
  }
}

const depositResult = graphql.object<DepositResult>()({
  name: "ProcessAppointmentDepositResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    appointmentId: graphql.field({ type: graphql.ID }), paymentId: graphql.field({ type: graphql.ID }),
    paymentSessionId: graphql.field({ type: graphql.ID }), status: graphql.field({ type: graphql.String }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const processAppointmentDeposit = graphql.field({
  type: depositResult,
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    providerCode: graphql.arg({ type: graphql.String }),
    idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  resolve(_source, args, context: Context) {
    return processAppointmentDepositTransaction(context, args);
  },
});
