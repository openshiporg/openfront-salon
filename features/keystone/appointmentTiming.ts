import { zonedDateKey } from "./scheduling/availability";

/**
 * Service-day gates. Check-in and checkout open on the appointment's salon
 * calendar day (location timezone); a no-show can only be recorded once the
 * start time has passed.
 */
export function assertServiceDayOpen(startTime: string | null | undefined, timezone: string | null | undefined, action: string, now = new Date()) {
  if (!startTime) throw new Error(`${action} needs a scheduled start time`);
  const zone = timezone || "UTC";
  if (zonedDateKey(new Date(startTime), zone) > zonedDateKey(now, zone)) throw new Error(`${action} opens on the day of the appointment`);
}

export function assertStartPassed(startTime: string | null | undefined, action: string, now = new Date()) {
  if (!startTime || new Date(startTime).getTime() > now.getTime()) throw new Error(`${action} can be recorded after the appointment start time`);
}
