import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface ClientDirectoryVisit {
  totalVisits: number | null;
  lastVisit: string | null;
  next: { id: string; startTime: string; timezone: string | null } | null;
}

/**
 * Visit facts for the clients already loaded by the management workspace:
 * total visits, last visit and the next booked appointment. A failed read
 * returns null so the list still renders, with those columns marked unknown.
 */
export async function getClientDirectoryVisits(ids: string[]): Promise<Record<string, ClientDirectoryVisit> | null> {
  if (!ids.length) return {};
  const response = await keystoneClient<{ clients: Array<{ id: string; totalVisits?: number | null; lastVisit?: string | null; appointments?: Array<{ id: string; startTime?: string | null; location?: { timezone?: string | null } | null }> }> }>(`
    query ClientDirectoryVisits($ids: [ID!], $now: DateTime!) {
      clients(where: { id: { in: $ids } }, take: 100) {
        id totalVisits lastVisit
        appointments(where: { status: { in: [pending, confirmed] }, startTime: { gte: $now } }, orderBy: { startTime: asc }, take: 1) {
          id startTime location { timezone }
        }
      }
    }
  `, { ids: ids.slice(0, 100), now: new Date().toISOString() });
  if (!response.success || !Array.isArray(response.data?.clients)) return null;
  return Object.fromEntries(response.data.clients.map((client) => {
    const next = client.appointments?.[0];
    return [client.id, {
      totalVisits: typeof client.totalVisits === 'number' ? client.totalVisits : null,
      lastVisit: client.lastVisit || null,
      next: next?.startTime ? { id: next.id, startTime: next.startTime, timezone: next.location?.timezone || null } : null,
    }];
  }));
}
