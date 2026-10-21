const UNRESOLVED_PAYMENT_SESSION_STATUSES = new Set(["pending", "requires_action", "authorized"]);
const RECONCILED_PAYMENT_SESSION_STATUSES = new Set([
  "completed", "failed", "cancelled", "partially_refunded", "refunded",
]);

type AppointmentPaymentSessionEvidence = { status?: unknown };

/** Refuse settlement while an appointment-linked payment attempt could still complete. */
export function assertNoUnresolvedAppointmentPaymentSessions(
  sessions: readonly AppointmentPaymentSessionEvidence[],
) {
  for (const session of sessions) {
    if (typeof session.status !== "string") {
      throw new Error("Payment session status is unknown; reconcile it before checkout");
    }
    if (UNRESOLVED_PAYMENT_SESSION_STATUSES.has(session.status)) {
      throw new Error("An unresolved payment attempt must be reconciled before checkout");
    }
    if (!RECONCILED_PAYMENT_SESSION_STATUSES.has(session.status)) {
      throw new Error("Payment session status is unknown; reconcile it before checkout");
    }
  }
}
