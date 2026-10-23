'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface PlatformSchedule {
  id: string;
  type?: string | null;
  dayOfWeek?: number | null;
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
    client?: { displayName?: string | null } | null;
    location?: { timezone?: string | null } | null;
    services: { name?: string | null }[];
  }[];
}

export interface ScheduleOperationsData {
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
  schedules(orderBy: [{ dayOfWeek: asc }, { startTime: asc }]) {
    id
    type
    dayOfWeek
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
    client { displayName }
    location { timezone }
    services { name }
  }
`;

export async function getScheduleOperations(): Promise<ScheduleOperationsData> {
  const response = await keystoneClient<{
    stylists: PlatformStylistSchedule[];
    stylistSchedulesCount: number;
    inactiveScheduleCount: number;
    activeProviderCount: number;
  }>(`
    query ScheduleOperations {
      stylists(where: { isActive: { equals: true } }, orderBy: { tier: desc }, take: 100) {
        ${STYLIST_SCHEDULE_QUERY}
      }
      stylistSchedulesCount
      inactiveScheduleCount: stylistSchedulesCount(where: { isAvailable: { equals: false } })
      activeProviderCount: stylistsCount(where: { isActive: { equals: true } })
    }
  `);

  if (!response.success) {
    console.error('Failed to load schedule operations:', response.error);
    return {
      stylists: [],
      scheduleCount: 0,
      inactiveScheduleCount: 0,
      activeProviderCount: 0,
    };
  }

  return {
    stylists: response.data.stylists || [],
    scheduleCount: response.data.stylistSchedulesCount || 0,
    inactiveScheduleCount: response.data.inactiveScheduleCount || 0,
    activeProviderCount: response.data.activeProviderCount || 0,
  };
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
