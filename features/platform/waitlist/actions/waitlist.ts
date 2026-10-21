'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import {
  OPTION_LIMIT,
  QUEUE_LIMIT,
  WAITLIST_LOAD_ERROR,
  parseWaitlistQueue,
  type WaitlistQueue,
  type WaitlistQueuePayload,
} from '../lib/queue-integrity';

export type { WaitlistQueue, WaitlistQueueEntry, WaitlistServiceOption, WaitlistStylistOption } from '../lib/queue-integrity';

export type WaitlistMutationResult = { success: true } | { success: false; error: string };

const WAITLIST_QUEUE_QUERY = `
  query WaitlistQueue($queueTake: Int!, $optionTake: Int!) {
    waitlistEntries(
      where: { isActive: { equals: true } }
      orderBy: [{ createdAt: asc }, { id: asc }]
      take: $queueTake
    ) {
      id
      client { id name email }
      guestName
      guestPhone
      status
      service { id name baseDuration }
      preferredStylists { id user { name } }
      preferredTimeRange
      dateRangeStart
      dateRangeEnd
      isActive
      notifiedAt
      notes
      createdAt
    }
    waitlistEntriesCount(where: { isActive: { equals: true } })
    services(where: { status: { equals: active } }, orderBy: [{ name: asc }, { id: asc }], take: $optionTake) {
      id
      name
      baseDuration
    }
    servicesCount(where: { status: { equals: active } })
    stylists(where: { isActive: { equals: true } }, orderBy: [{ createdAt: asc }, { id: asc }], take: $optionTake) {
      id
      tier
      user { name }
    }
    stylistsCount(where: { isActive: { equals: true } })
  }
`;

const JOIN_WAITLIST_MUTATION = `
  mutation JoinWaitlist(
    $guestName: String!
    $guestPhone: String
    $serviceId: ID!
    $preferredStylistIds: [ID!]
    $preferredTimeRange: String
    $notes: String
    $idempotencyKey: String!
  ) {
    joinWaitlist(
      guestName: $guestName
      guestPhone: $guestPhone
      serviceId: $serviceId
      preferredStylistIds: $preferredStylistIds
      preferredTimeRange: $preferredTimeRange
      notes: $notes
      idempotencyKey: $idempotencyKey
    ) {
      success
      waitlistEntryId
      error
    }
  }
`;

const TRANSITION_WAITLIST_MUTATION = `
  mutation TransitionWaitlistEntry($id: ID!, $action: String!, $reason: String) {
    transitionWaitlistEntry(waitlistEntryId: $id, action: $action, reason: $reason) {
      success
      status
      error
    }
  }
`;

const TRANSITION_REASONS = {
  notify: 'Availability notification sent from waitlist queue',
  remove: 'Removed from waitlist queue',
} as const;

export type WaitlistTransitionAction = keyof typeof TRANSITION_REASONS;

const PREFERRED_TIME_RANGES = new Set(['morning', 'afternoon', 'evening']);

function optionalText(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function getWaitlistQueue(): Promise<WaitlistQueue> {
  const response = await keystoneClient<WaitlistQueuePayload>(WAITLIST_QUEUE_QUERY, { queueTake: QUEUE_LIMIT, optionTake: OPTION_LIMIT });
  if (!response.success) return { status: 'error', message: WAITLIST_LOAD_ERROR };
  // Missing or inconsistent counts fail closed instead of certifying a capped list complete.
  return parseWaitlistQueue(response.data);
}

export async function joinWaitlist(input: {
  guestName: string;
  guestPhone?: string | null;
  serviceId: string;
  preferredStylistId?: string | null;
  preferredTimeRange?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}): Promise<WaitlistMutationResult> {
  // Server actions receive untrusted client payloads; never dereference a missing or non-object input.
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, error: 'Client name and service are required.' };
  }
  const guestName = optionalText(input.guestName, 120);
  const serviceId = optionalText(input.serviceId, 64);
  const idempotencyKey = optionalText(input.idempotencyKey, 128);
  if (!guestName || !serviceId || !idempotencyKey) {
    return { success: false, error: 'Client name and service are required.' };
  }
  const preferredTimeRange = optionalText(input.preferredTimeRange, 32);
  const preferredStylistId = optionalText(input.preferredStylistId, 64);

  // Keystone's joinWaitlist resolver remains the authority for permissions,
  // service/stylist validity and idempotent replay.
  const response = await keystoneClient<{ joinWaitlist: { success: boolean; error?: string | null } | null }>(
    JOIN_WAITLIST_MUTATION,
    {
      guestName,
      guestPhone: optionalText(input.guestPhone, 40),
      serviceId,
      preferredStylistIds: preferredStylistId ? [preferredStylistId] : [],
      preferredTimeRange: preferredTimeRange && PREFERRED_TIME_RANGES.has(preferredTimeRange) ? preferredTimeRange : null,
      notes: optionalText(input.notes, 1000),
      idempotencyKey,
    },
  );

  if (!response.success) return { success: false, error: 'The waitlist request could not be confirmed. Retry to replay the same request.' };
  if (!response.data.joinWaitlist?.success) {
    return { success: false, error: response.data.joinWaitlist?.error || 'The waitlist request was not accepted.' };
  }
  revalidatePath('/dashboard/platform/waitlist');
  return { success: true };
}

export async function transitionWaitlistEntry(id: string, action: WaitlistTransitionAction): Promise<WaitlistMutationResult> {
  const entryId = optionalText(id, 64);
  if (!entryId || typeof action !== 'string' || !Object.hasOwn(TRANSITION_REASONS, action)) return { success: false, error: 'Unsupported waitlist action.' };

  const response = await keystoneClient<{ transitionWaitlistEntry: { success: boolean; error?: string | null } | null }>(
    TRANSITION_WAITLIST_MUTATION,
    { id: entryId, action, reason: TRANSITION_REASONS[action] },
  );

  if (!response.success) return { success: false, error: 'The waitlist update could not be confirmed. Refresh before retrying.' };
  if (!response.data.transitionWaitlistEntry?.success) {
    return { success: false, error: response.data.transitionWaitlistEntry?.error || 'The waitlist update was not accepted.' };
  }
  revalidatePath('/dashboard/platform/waitlist');
  return { success: true };
}
