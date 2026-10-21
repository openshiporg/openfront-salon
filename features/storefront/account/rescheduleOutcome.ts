function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A reschedule is confirmed only by an exact target ID and persisted revision. */
export function isVerifiedRescheduleResponse(responseSuccess: boolean, value: unknown, appointmentId: string): boolean {
  return responseSuccess
    && isRecord(value)
    && value.success === true
    && value.appointmentId === appointmentId
    && Number.isInteger(value.revision)
    && Number(value.revision) > 0;
}
