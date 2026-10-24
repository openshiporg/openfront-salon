import { zonedDateKey } from '@/features/keystone/scheduling/availability';

export type LifecycleGates = { checkIn: string | null; noShow: string | null };

/** Mirrors the server gates in features/keystone/appointmentTiming.ts so blocked actions are disabled with the reason. */
export function lifecycleGates(startTime: string | null | undefined, timezone: string | null | undefined, now = new Date()): LifecycleGates {
  if (!startTime) return { checkIn: 'Check-in needs a scheduled start time', noShow: 'A no-show needs a scheduled start time' };
  const start = new Date(startTime);
  const zone = timezone || 'UTC';
  let checkIn: string | null = null;
  try {
    if (zonedDateKey(start, zone) > zonedDateKey(now, zone)) checkIn = 'Check-in opens on the day of the appointment';
  } catch {
    checkIn = null;
  }
  return { checkIn, noShow: start.getTime() > now.getTime() ? 'No-show can be recorded after the start time' : null };
}
