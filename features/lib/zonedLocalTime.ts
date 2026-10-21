const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function zoneOffsetMs(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - instant;
}

/** Converts a `datetime-local` value entered in the salon's time zone to an ISO instant. */
export function zonedLocalTimeToIso(value: unknown, timeZone: string): string | null {
  if (typeof value !== 'string') return null;
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const first = wallClock - zoneOffsetMs(wallClock, timeZone);
    const instant = wallClock - zoneOffsetMs(first, timeZone);
    return Number.isFinite(instant) ? new Date(instant).toISOString() : null;
  } catch {
    return null;
  }
}
