// Pure validation for the bounded waitlist queue read. Kept outside the
// 'use server' actions module so it is never exposed as a server action.

// Bounded reads: the queue shows the oldest entries first and reports the true
// count so operators are never told a truncated list is complete.
export const QUEUE_LIMIT = 100;
export const OPTION_LIMIT = 200;

export const WAITLIST_LOAD_ERROR = 'The waitlist could not be loaded. Retry, or contact a salon manager if this continues.';

export interface WaitlistQueueEntry {
  id: string;
  client: { id: string; name: string | null; email: string | null } | null;
  guestName: string | null;
  guestPhone: string | null;
  status: string | null;
  service: { id: string; name: string | null; baseDuration: number | null } | null;
  preferredStylists: { id: string; user: { name: string | null } | null }[];
  preferredTimeRange: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  isActive: boolean | null;
  notifiedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WaitlistServiceOption { id: string; name: string; baseDuration: number | null }
export interface WaitlistStylistOption { id: string; name: string; tier: string | null }

export type WaitlistQueue =
  | {
      status: 'ok';
      entries: WaitlistQueueEntry[];
      total: number;
      truncated: boolean;
      services: WaitlistServiceOption[];
      servicesTruncated: boolean;
      stylists: WaitlistStylistOption[];
      stylistsTruncated: boolean;
    }
  | { status: 'error'; message: string };

export interface WaitlistQueuePayload {
  waitlistEntries?: unknown;
  waitlistEntriesCount?: unknown;
  services?: unknown;
  servicesCount?: unknown;
  stylists?: unknown;
  stylistsCount?: unknown;
}

type Row = Record<string, any> & { id: string };

/**
 * Keystone answers denied list access with an empty list and a zero count, so a
 * genuinely empty page is valid. A missing, non-integer or inconsistent count
 * is not: it can no longer prove whether the bounded page is complete.
 */
export function boundedRows(rows: unknown, count: unknown, limit: number): { rows: Row[]; total: number; truncated: boolean } | null {
  if (!Array.isArray(rows) || rows.length > limit) return null;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < rows.length) return null;
  // A page shorter than its limit is the whole result, so its count must match.
  if (rows.length < limit && count !== rows.length) return null;
  if (!rows.every((row) => row !== null && typeof row === 'object' && typeof row.id === 'string' && row.id !== '')) return null;
  return { rows: rows as Row[], total: count, truncated: count > rows.length };
}

function compareIds(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function parseWaitlistQueue(data: WaitlistQueuePayload | null | undefined): WaitlistQueue {
  const queue = boundedRows(data?.waitlistEntries, data?.waitlistEntriesCount, QUEUE_LIMIT);
  const services = boundedRows(data?.services, data?.servicesCount, OPTION_LIMIT);
  const stylists = boundedRows(data?.stylists, data?.stylistsCount, OPTION_LIMIT);
  if (!queue || !services || !stylists) return { status: 'error', message: WAITLIST_LOAD_ERROR };

  // Related records the operator cannot read stay null; only the list shape is normalized.
  const entries = queue.rows.map((entry) => ({
    ...entry,
    preferredStylists: Array.isArray(entry.preferredStylists) ? entry.preferredStylists : [],
  })) as WaitlistQueueEntry[];

  return {
    status: 'ok',
    entries,
    total: queue.total,
    truncated: queue.truncated,
    services: services.rows.map((service) => ({
      id: service.id,
      name: service.name || 'Unnamed service',
      baseDuration: service.baseDuration ?? null,
    })),
    servicesTruncated: services.truncated,
    stylists: stylists.rows
      .map((stylist) => ({ id: stylist.id, name: stylist.user?.name || 'Unnamed stylist', tier: stylist.tier ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name) || compareIds(a.id, b.id)),
    stylistsTruncated: stylists.truncated,
  };
}
