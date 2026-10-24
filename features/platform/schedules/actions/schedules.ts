'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { appointmentContact } from '@/features/platform/lib/appointmentContact';

export interface PlatformSchedule {
  id: string;
  type?: string | null;
  dayOfWeek?: number | null;
  localDate?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isAvailable?: boolean | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  reason?: string | null;
  revision: number;
  location?: { id: string } | null;
}

export interface PlatformStylistSchedule {
  id: string;
  role?: string | null;
  tier?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  locations: { id: string; name?: string | null }[];
  specializations: {
    id: string;
    name?: string | null;
    baseDuration?: number | null;
    requiresPatchTest?: boolean | null;
  }[];
  schedules: PlatformSchedule[];
  appointments: {
    id: string;
    startTime?: string | null;
    duration?: number | null;
    status?: string | null;
    metadata?: unknown;
    client?: { displayName?: string | null } | null;
    location?: { timezone?: string | null } | null;
    services: { name?: string | null }[];
  }[];
}

export interface TimeOffEntry {
  id: string;
  localDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  revision: number;
  stylistId: string;
  stylistName: string;
  locationName: string;
  clashes: { id: string; startTime: string; clientName: string; timezone?: string | null }[];
}

export interface ScheduleOperationsData {
  timeOff: TimeOffEntry[];
  stylists: PlatformStylistSchedule[];
  scheduleCount: number;
  inactiveScheduleCount: number;
  activeProviderCount: number;
}

const STYLIST_SCHEDULE_QUERY = `
  id
  role
  tier
  status
  isActive
  user {
    id
    name
    email
    phone
  }
  locations { id name }
  specializations {
    id
    name
    baseDuration
    requiresPatchTest
  }
  schedules(where: { type: { equals: recurring } }, orderBy: [{ dayOfWeek: asc }, { startTime: asc }]) {
    id
    type
    dayOfWeek
    localDate
    date
    startTime
    endTime
    isAvailable
    breakStart
    breakEnd
    reason
    revision
    location { id }
  }
  appointments(
    where: { status: { in: [pending, confirmed, in_progress] } }
    orderBy: { startTime: asc }
    take: 8
  ) {
    id
    startTime
    duration
    status
    metadata
    client { displayName }
    location { timezone }
    services { name }
  }
`;

function todayKey(timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function zonedKey(value: string, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

type TimeOffRow = { id: string; localDate?: string | null; startTime?: string | null; endTime?: string | null; reason?: string | null; revision: number; stylist?: { id: string; user?: { name?: string | null } | null } | null; location?: { name?: string | null; timezone?: string | null } | null };
type UpcomingRow = { id: string; startTime: string; duration?: number | null; stylist?: { id: string } | null; location?: { timezone?: string | null } | null; client?: { displayName?: string | null } | null; metadata?: unknown };

export async function getScheduleOperations(): Promise<ScheduleOperationsData> {
  const response = await keystoneClient<{
    stylists: PlatformStylistSchedule[];
    stylistSchedulesCount: number;
    inactiveScheduleCount: number;
    activeProviderCount: number;
    timeOff: TimeOffRow[];
    upcoming: UpcomingRow[];
  }>(`
    query ScheduleOperations($fromDate: String!, $now: DateTime!) {
      stylists(where: { isActive: { equals: true } }, orderBy: { tier: desc }, take: 100) {
        ${STYLIST_SCHEDULE_QUERY}
      }
      stylistSchedulesCount(where: { type: { equals: recurring } })
      inactiveScheduleCount: stylistSchedulesCount(where: { type: { equals: recurring }, isAvailable: { equals: false } })
      activeProviderCount: stylistsCount(where: { isActive: { equals: true } })
      timeOff: stylistSchedules(where: { type: { equals: time_off }, isAvailable: { equals: false }, localDate: { gte: $fromDate } }, orderBy: { localDate: asc }, take: 200) {
        id localDate startTime endTime reason revision stylist { id user { name } } location { name timezone }
      }
      upcoming: appointments(where: { status: { in: [pending, confirmed] }, startTime: { gte: $now } }, orderBy: { startTime: asc }, take: 500) {
        id startTime duration metadata stylist { id } location { timezone } client { displayName }
      }
    }
  `, { fromDate: (() => { const d = new Date(Date.now() - 86_400_000); return d.toISOString().slice(0, 10); })(), now: new Date().toISOString() });

  if (!response.success) {
    console.error('Failed to load schedule operations:', response.error);
    return {
      timeOff: [],
      stylists: [],
      scheduleCount: 0,
      inactiveScheduleCount: 0,
      activeProviderCount: 0,
    };
  }

  const upcoming = response.data.upcoming || [];
  const minutes = (value?: string | null) => { const [h, m] = String(value || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  // One entry per stylist and date; the same block is written for each of the stylist's locations.
  const seen = new Set<string>();
  const timeOff = (response.data.timeOff || []).flatMap((row) => {
    const key = `${row.stylist?.id}:${row.localDate}:${row.startTime}:${row.endTime}`;
    if (!row.stylist?.id || !row.localDate || seen.has(key) || row.localDate < todayKey(row.location?.timezone)) return [];
    seen.add(key);
    const clashes = upcoming.filter((appointment) => {
      if (appointment.stylist?.id !== row.stylist!.id) return false;
      const zone = appointment.location?.timezone || row.location?.timezone;
      if (zonedKey(appointment.startTime, zone) !== row.localDate) return false;
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(appointment.startTime));
      const start = minutes(parts);
      return start < minutes(row.endTime) && start + (appointment.duration || 60) > minutes(row.startTime);
    }).map((appointment) => ({ id: appointment.id, startTime: appointment.startTime, clientName: appointment.client?.displayName || appointmentContact({ metadata: appointment.metadata }).name, timezone: appointment.location?.timezone }));
    return [{
      id: row.id, localDate: row.localDate, startTime: row.startTime || '00:00', endTime: row.endTime || '23:59', reason: row.reason || '', revision: row.revision,
      stylistId: row.stylist.id, stylistName: row.stylist.user?.name || 'Stylist', locationName: row.location?.name || '', clashes,
    }];
  });

  return {
    timeOff,
    stylists: response.data.stylists || [],
    scheduleCount: response.data.stylistSchedulesCount || 0,
    inactiveScheduleCount: response.data.inactiveScheduleCount || 0,
    activeProviderCount: response.data.activeProviderCount || 0,
  };
}

const UPSERT_TIME_OFF = `
  mutation UpsertTimeOff($stylistId: ID!, $locationId: ID!, $localDate: String!, $startTime: String!, $endTime: String!, $reason: String, $idempotencyKey: String) {
    upsertStylistSchedule(stylistId: $stylistId, locationId: $locationId, type: "time_off", localDate: $localDate, startTime: $startTime, endTime: $endTime, isAvailable: false, reason: $reason, idempotencyKey: $idempotencyKey) {
      success
      error
    }
  }
`;

function dateRange(from: string, to: string) {
  const dates: string[] = [];
  const start = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to || from}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  for (let day = start; day <= end && dates.length <= 31; day = new Date(day.getTime() + 86_400_000)) dates.push(day.toISOString().slice(0, 10));
  return dates.length > 31 ? null : dates;
}

/** Blocks one stylist for a date or date range (all day or set hours) at every location they work. */
export async function addTimeOff(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const stylistId = formData.get('stylistId')?.toString() || '';
  const from = formData.get('from')?.toString() || '';
  const to = formData.get('to')?.toString() || from;
  const allDay = formData.get('allDay')?.toString() !== 'false';
  const startTime = allDay ? '00:00' : formData.get('start')?.toString() || '';
  const endTime = allDay ? '23:59' : formData.get('end')?.toString() || '';
  const reason = formData.get('reason')?.toString().trim() || 'Time off';
  if (!stylistId || !from) return { success: false, error: 'Choose a stylist and date.' };
  if (!startTime || !endTime) return { success: false, error: 'Enter start and end times.' };
  const dates = dateRange(from, to);
  if (!dates) return { success: false, error: 'Choose an end date on or after the start, at most 31 days.' };

  const stylist = await keystoneClient<{ stylist: { locations: { id: string }[] } | null }>(`
    query TimeOffStylist($id: ID!) { stylist(where: { id: $id }) { locations { id } } }
  `, { id: stylistId });
  const locations = stylist.success ? stylist.data.stylist?.locations || [] : [];
  if (!locations.length) return { success: false, error: 'This stylist has no location assignment.' };

  const failures: string[] = [];
  for (const localDate of dates) {
    for (const location of locations) {
      const response = await keystoneClient<{ upsertStylistSchedule: { success: boolean; error?: string | null } }>(UPSERT_TIME_OFF, {
        stylistId, locationId: location.id, localDate, startTime, endTime, reason, idempotencyKey: `time-off:${stylistId}:${location.id}:${localDate}:${randomUUID()}`,
      });
      const result = response.success ? response.data.upsertStylistSchedule : null;
      if (!result?.success) failures.push(`${localDate}: ${result?.error || 'could not be saved'}`);
    }
  }
  revalidatePath('/dashboard/platform/schedules');
  return failures.length ? { success: false, error: [...new Set(failures)].join(' · ') } : { success: true };
}

/** Withdraws a time-off entry (and its copies at the stylist's other locations). */
export async function withdrawTimeOff(formData: FormData): Promise<void> {
  const stylistId = formData.get('stylistId')?.toString() || '';
  const localDate = formData.get('localDate')?.toString() || '';
  if (!stylistId || !localDate) return;
  const rows = await keystoneClient<{ stylistSchedules: { id: string; revision: number }[] }>(`
    query TimeOffCopies($stylistId: ID!, $localDate: String!) {
      stylistSchedules(where: { type: { equals: time_off }, isAvailable: { equals: false }, localDate: { equals: $localDate }, stylist: { id: { equals: $stylistId } } }, take: 50) { id revision }
    }
  `, { stylistId, localDate });
  for (const row of rows.success ? rows.data.stylistSchedules : []) {
    const response = await keystoneClient<{ setStylistScheduleAvailability: { success: boolean; error?: string | null } }>(`
      mutation WithdrawTimeOff($scheduleId: ID!, $expectedRevision: Int!) {
        setStylistScheduleAvailability(scheduleId: $scheduleId, isAvailable: true, expectedRevision: $expectedRevision) { success error }
      }
    `, { scheduleId: row.id, expectedRevision: row.revision });
    if (!response.success || !response.data.setStylistScheduleAvailability.success) console.error('Failed to withdraw time off:', response.success ? response.data.setStylistScheduleAvailability.error : response.error);
  }
  revalidatePath('/dashboard/platform/schedules');
}

export async function setScheduleAvailability(formData: FormData): Promise<void> {
  const id = formData.get('id')?.toString();
  const isAvailable = formData.get('isAvailable')?.toString() === 'true';
  const reason = formData.get('reason')?.toString();
  const expectedRevision = Number(formData.get('revision'));

  if (!id || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    console.error('Missing schedule id or revision.');
    return;
  }

  const response = await keystoneClient<{
    setStylistScheduleAvailability: { success: boolean; error?: string | null };
  }>(
    `
      mutation SetScheduleAvailability(
        $scheduleId: ID!
        $isAvailable: Boolean!
        $reason: String
        $expectedRevision: Int!
      ) {
        setStylistScheduleAvailability(
          scheduleId: $scheduleId
          isAvailable: $isAvailable
          reason: $reason
          expectedRevision: $expectedRevision
        ) {
          success
          error
        }
      }
    `,
    {
      scheduleId: id,
      isAvailable,
      reason: reason || (isAvailable ? '' : 'Blocked by salon'),
      expectedRevision,
    }
  );

  if (!response.success || !response.data.setStylistScheduleAvailability.success) {
    console.error(
      'Failed to update schedule availability:',
      response.success ? response.data.setStylistScheduleAvailability.error : response.error,
    );
    return;
  }

  revalidatePath('/dashboard/platform/schedules');
  revalidatePath('/dashboard/stylist-schedules');
}

const UPSERT_SCHEDULE = `
  mutation UpsertWeeklySchedule($scheduleId: ID, $stylistId: ID!, $locationId: ID!, $dayOfWeek: Int, $startTime: String!, $endTime: String!, $breakStart: String, $breakEnd: String, $isAvailable: Boolean, $reason: String, $idempotencyKey: String, $expectedRevision: Int) {
    upsertStylistSchedule(scheduleId: $scheduleId, stylistId: $stylistId, locationId: $locationId, type: "recurring", dayOfWeek: $dayOfWeek, startTime: $startTime, endTime: $endTime, breakStart: $breakStart, breakEnd: $breakEnd, isAvailable: $isAvailable, reason: $reason, idempotencyKey: $idempotencyKey, expectedRevision: $expectedRevision) {
      success
      error
    }
  }
`;

/** Saves a stylist's recurring week: one block per day, created, edited or switched off. */
export async function saveWeeklyHours(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const stylistId = formData.get('stylistId')?.toString() || '';
  const locationId = formData.get('locationId')?.toString() || '';
  if (!stylistId || !locationId) return { success: false, error: 'Choose a stylist and location.' };
  const failures: string[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const field = (name: string) => formData.get(`day.${day}.${name}`)?.toString().trim() || '';
    const working = field('working') === 'true';
    const scheduleId = field('scheduleId');
    const revision = Number(field('revision'));
    const startTime = field('start');
    const endTime = field('end');
    if (!scheduleId && !working) continue;
    if (working && (!startTime || !endTime)) { failures.push(`${dayName(day)}: enter start and end`); continue; }
    const response = await keystoneClient<{ upsertStylistSchedule: { success: boolean; error?: string | null } }>(UPSERT_SCHEDULE, {
      scheduleId: scheduleId || null,
      stylistId,
      locationId,
      dayOfWeek: day,
      startTime: startTime || field('previousStart') || '09:00',
      endTime: endTime || field('previousEnd') || '17:00',
      breakStart: working ? field('breakStart') || null : field('previousBreakStart') || null,
      breakEnd: working ? field('breakEnd') || null : field('previousBreakEnd') || null,
      isAvailable: working,
      reason: working ? '' : 'Day off',
      idempotencyKey: scheduleId ? null : `weekly-hours:${stylistId}:${day}:${randomUUID()}`,
      expectedRevision: scheduleId ? revision : null,
    });
    const result = response.success ? response.data.upsertStylistSchedule : null;
    if (!result?.success) failures.push(`${dayName(day)}: ${result?.error || 'could not be saved'}`);
  }
  revalidatePath('/dashboard/platform/schedules');
  return failures.length ? { success: false, error: failures.join(' · ') } : { success: true };
}

function dayName(day: number) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
}
