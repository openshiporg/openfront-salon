'use server';

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
    client?: { user?: { name?: string | null } | null } | null;
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
    client { user { name } }
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
