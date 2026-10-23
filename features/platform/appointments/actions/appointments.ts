'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { loadShopTodayWhere } from '@/features/platform/lib/loadShopTodayWhere';
import {
  resolveAppointmentOperationsResponse,
  type AppointmentOperationsQueryData,
  type AppointmentOperationsReadResult,
} from '../lib/appointmentOperationsRead';
import {
  resolveAppointmentTransitionFeedback,
  type AppointmentTransitionFeedback,
} from '../lib/appointmentTransitionFeedback';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface PlatformAppointment {
  id: string;
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  status: AppointmentStatus;
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  clientNotes?: string | null;
  internalNotes?: string | null;
  metadata?: unknown;
  location?: { id: string; name?: string | null; timezone?: string | null } | null;
  client?: {
    id: string;
    user?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    totalVisits?: number | null;
    lifetimeValue?: number | null;
    marketingConsent?: boolean | null;
  } | null;
  stylist?: {
    id: string;
    tier?: string | null;
    user?: {
      name?: string | null;
    } | null;
  } | null;
  services: {
    id: string;
    name?: string | null;
    basePrice?: number | null;
    baseDuration?: number | null;
    requiresPatchTest?: boolean | null;
    requiresConsultation?: boolean | null;
  }[];
  payment?: {
    id: string;
    status?: string | null;
    totalAmount?: number | null;
    paymentMethod?: string | null;
  } | null;
  lineItems: {
    id: string;
    price?: number | null;
    duration?: number | null;
    staff?: { user?: { name?: string | null } | null } | null;
    service?: { name?: string | null } | null;
  }[];
}

const APPOINTMENT_QUERY = `
  id
  startTime
  endTime
  duration
  status
  depositAmount
  depositPaid
  clientNotes
  internalNotes
  metadata
  location { id name timezone }
  client {
    id
    totalVisits
    lifetimeValue
    marketingConsent
    guestName
    guestEmail
    guestPhone
    user {
      name
      email
      phone
    }
  }
  stylist {
    id
    tier
    user {
      name
    }
  }
  services {
    id
    name
    basePrice
    baseDuration
    requiresPatchTest
    requiresConsultation
  }
  lineItems {
    id
    price
    duration
    staff { user { name } }
    service { name }
  }
  payment {
    id
    status
    totalAmount
    paymentMethod
  }
`;

function buildWhere(status: string | null | undefined, todayWhere: Record<string, unknown>) {
  if (!status || status === 'all') return {};

  if (status === 'today') return todayWhere;

  return { status: { equals: status } };
}

function revalidateAppointmentOperations() {
  revalidatePath('/dashboard/platform/appointments');
  revalidatePath('/dashboard/appointments');
}

export async function transitionAppointmentStatus(formData: FormData): Promise<AppointmentTransitionFeedback> {
  const id = formData.get('id')?.toString();
  const status = formData.get('status')?.toString() as AppointmentStatus | undefined;

  if (!id || !status) return { status: 'failure' };

  try {
    const response = await keystoneClient<{ transitionAppointment: { success: boolean; error?: string | null } }>(
      `
        mutation TransitionAppointment($id: ID!, $status: String!, $reason: String) {
          transitionAppointment(appointmentId: $id, status: $status, reason: $reason) {
            success
            error
          }
        }
      `,
      {
        id,
        status,
        reason: status === 'cancelled' ? 'Cancelled by salon' : null,
      }
    );
    const feedback = resolveAppointmentTransitionFeedback(response);

    if (feedback.status === 'failure') {
      console.error('Failed to transition appointment:', response.success ? response.data?.transitionAppointment?.error : response.error);
      return feedback;
    }

    revalidateAppointmentOperations();
    return feedback;
  } catch {
    console.error('Failed to transition appointment');
    return { status: 'failure' };
  }
}

export async function cancelAppointmentFromQueue(formData: FormData): Promise<AppointmentTransitionFeedback> {
  const id = formData.get('id')?.toString();
  const cancellationReason = formData.get('cancellationReason')?.toString() || 'Cancelled by salon';

  if (!id) return { status: 'failure' };

  try {
    const response = await keystoneClient<{ transitionAppointment: { success: boolean; error?: string | null } }>(
      `
        mutation CancelAppointment($id: ID!, $reason: String!) {
          transitionAppointment(appointmentId: $id, status: "cancelled", reason: $reason) {
            success
            error
          }
        }
      `,
      { id, reason: cancellationReason }
    );
    const feedback = resolveAppointmentTransitionFeedback(response);

    if (feedback.status === 'failure') {
      console.error('Failed to cancel appointment:', response.success ? response.data?.transitionAppointment?.error : response.error);
      return feedback;
    }

    revalidateAppointmentOperations();
    return feedback;
  } catch {
    console.error('Failed to cancel appointment');
    return { status: 'failure' };
  }
}

export async function getAppointmentOperations(status?: string | null): Promise<AppointmentOperationsReadResult<PlatformAppointment>> {
  const query = `
    query AppointmentOperations($where: AppointmentWhereInput!, $todayWhere: AppointmentWhereInput!) {
      appointments(where: $where, orderBy: { startTime: asc }, take: 100) {
        ${APPOINTMENT_QUERY}
      }
      allCount: appointmentsCount
      pendingCount: appointmentsCount(where: { status: { equals: pending } })
      confirmedCount: appointmentsCount(where: { status: { equals: confirmed } })
      inProgressCount: appointmentsCount(where: { status: { equals: in_progress } })
      completedCount: appointmentsCount(where: { status: { equals: completed } })
      cancelledCount: appointmentsCount(where: { status: { equals: cancelled } })
      noShowCount: appointmentsCount(where: { status: { equals: no_show } })
      todayCount: appointmentsCount(where: $todayWhere)
    }
  `;

  const todayWhere = await loadShopTodayWhere();
  if (!todayWhere) {
    console.error('Failed to load appointment shop-day scope');
    return { status: 'unavailable' };
  }

  const response = await keystoneClient<AppointmentOperationsQueryData<PlatformAppointment>>(query, {
    where: buildWhere(status, todayWhere),
    todayWhere,
  });
  const result = resolveAppointmentOperationsResponse(response);
  if (result.status === 'unavailable') {
    console.error('Failed to load appointment operations:', response.success ? 'Incomplete appointment operations response' : response.error);
  }
  return result;
}
