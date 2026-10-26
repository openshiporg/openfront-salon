'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

/** Minutes since midnight on the salon wall clock. */
export interface ShiftWindow { start: number; end: number }

/** One stylist's working day: windows they are on the floor, already net of breaks and time off. */
export interface DayShift {
  stylistId: string;
  name: string;
  windows: ShiftWindow[];
}

interface ShiftRow {
  type?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isAvailable?: boolean | null;
  breakStart?: string | null;
  breakEnd?: string | null;
}

function toMinutes(value?: string | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return Math.min(24 * 60, Number(match[1]) * 60 + Number(match[2]));
}

/** Union of windows, sorted, merged where they touch (one row per location duplicates the same hours). */
function merge(windows: ShiftWindow[]) {
  const sorted = windows.filter((window) => window.end > window.start).sort((a, b) => a.start - b.start);
  const out: ShiftWindow[] = [];
  for (const window of sorted) {
    const last = out[out.length - 1];
    if (last && window.start <= last.end) last.end = Math.max(last.end, window.end);
    else out.push({ ...window });
  }
  return out;
}

function subtract(windows: ShiftWindow[], cut: ShiftWindow) {
  return windows.flatMap((window) => {
    if (cut.end <= window.start || cut.start >= window.end) return [window];
    const parts: ShiftWindow[] = [];
    if (cut.start > window.start) parts.push({ start: window.start, end: cut.start });
    if (cut.end < window.end) parts.push({ start: cut.end, end: window.end });
    return parts;
  });
}

/**
 * Who works today and when, read-only, for the day board's lanes. Returns null when the
 * schedules cannot be read (the board then falls back to lanes derived from appointments).
 */
export async function getDayShifts(timeZone: string, now: Date = new Date()): Promise<DayShift[] | null> {
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);

  const response = await keystoneClient<{
    stylists: { id: string; user?: { name?: string | null } | null; schedules: ShiftRow[] }[];
  }>(`
    query DayBoardShifts($dayOfWeek: Int!, $localDate: String!) {
      stylists(where: { isActive: { equals: true } }, take: 100) {
        id
        user { name }
        schedules(where: { OR: [
          { type: { equals: recurring }, dayOfWeek: { equals: $dayOfWeek } },
          { type: { in: [one_time, time_off] }, localDate: { equals: $localDate } }
        ] }) {
          type
          startTime
          endTime
          isAvailable
          breakStart
          breakEnd
        }
      }
    }
  `, { dayOfWeek, localDate });

  if (!response.success) {
    console.error('Failed to load day board shifts:', response.error);
    return null;
  }

  return (response.data.stylists || []).flatMap((stylist) => {
    const rows = stylist.schedules || [];
    let windows: ShiftWindow[] = [];
    const cuts: ShiftWindow[] = [];
    for (const row of rows) {
      const start = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      if (start === null || end === null) continue;
      if (row.type === 'time_off' || row.isAvailable === false) {
        cuts.push({ start, end });
        continue;
      }
      windows.push({ start, end });
      const breakStart = toMinutes(row.breakStart);
      const breakEnd = toMinutes(row.breakEnd);
      if (breakStart !== null && breakEnd !== null && breakEnd > breakStart) cuts.push({ start: breakStart, end: breakEnd });
    }
    windows = merge(windows);
    for (const cut of cuts) windows = subtract(windows, cut);
    if (!windows.length) return [];
    return [{ stylistId: stylist.id, name: stylist.user?.name || 'Stylist', windows }];
  });
}
