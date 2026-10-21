export function bookingPolicy() {
  const cancellationNoticeMinutes = Number(process.env.CLIENT_CANCELLATION_NOTICE_MINUTES || 1440);
  const rescheduleNoticeMinutes = Number(process.env.CLIENT_RESCHEDULE_NOTICE_MINUTES || 1440);
  if (![cancellationNoticeMinutes, rescheduleNoticeMinutes].every(value => Number.isInteger(value) && value >= 0 && value <= 525600)) throw new Error("Booking policy configuration is invalid");
  return { version: process.env.CLIENT_BOOKING_POLICY_VERSION || "salon-booking-v2", cancellationNoticeMinutes, rescheduleNoticeMinutes };
}

/** Server-side contract: a non-operator must affirm the exact current policy version. */
export function hasCurrentBookingPolicyAffirmation(accepted: unknown, submittedVersion: unknown, currentVersion: string) {
  return accepted === true && submittedVersion === currentVersion;
}

/** A policy deadline is usable only as an explicit-zone instant, matching persisted ISO snapshots. */
export function isPolicyDeadlineOpen(deadline: unknown, now: number = Date.now()) {
  if (typeof deadline !== "string" || !/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(deadline)) return false;
  const deadlineAt = Date.parse(deadline);
  return Number.isFinite(deadlineAt) && deadlineAt > now;
}
