import type { ClientPortalReadResult } from "./clientPortalRead";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A mutation response confirms cancellation only when it identifies the requested appointment and terminal state. */
export function isVerifiedCancellationResponse(responseSuccess: boolean, value: unknown, appointmentId: string): boolean {
  return responseSuccess
    && isRecord(value)
    && value.success === true
    && value.appointmentId === appointmentId
    && value.status === "cancelled";
}

/** Reconcile ambiguous command results only against the current owner-scoped portal projection. */
export function isOwnedAppointmentCancelled(portal: ClientPortalReadResult, appointmentId: string): boolean {
  if (portal.status !== "available") return false;
  return portal.portal.appointments.some((appointment) =>
    isRecord(appointment) && appointment.id === appointmentId && appointment.status === "cancelled",
  );
}
