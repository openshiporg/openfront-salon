import { timeToMinutes, zonedDateKey, zonedDateTimeToUtc } from "./availability";

/** Seed offsets and wall-clock times belong to the salon, not the server timezone. */
export function onboardingAppointmentStart(
  item: { dayOffset?: number; time?: string },
  timezone: string,
  now = new Date(),
): Date {
  const offset = item.dayOffset ?? 1;
  if (!Number.isInteger(offset) || Math.abs(offset) > 366) {
    throw new Error("Appointment day offset must be an integer within 366 days");
  }
  const date = new Date(`${zonedDateKey(now, timezone)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return zonedDateTimeToUtc(date.toISOString().slice(0, 10), timeToMinutes(item.time || "10:00"), timezone);
}
