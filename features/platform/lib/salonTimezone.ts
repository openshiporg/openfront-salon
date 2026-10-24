import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

function validZone(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return value.trim();
  } catch {
    return null;
  }
}

/** The salon's display timezone: the first active location's, so server-rendered times never fall back to UTC. */
export async function getSalonTimezone(): Promise<string | undefined> {
  const response = await keystoneClient<{ locations: Array<{ timezone?: string | null }> }>(`
    query SalonTimezone {
      locations(where: { isActive: { equals: true } }, orderBy: { createdAt: asc }, take: 1) { timezone }
    }
  `);
  if (!response.success) return undefined;
  return validZone(response.data?.locations?.[0]?.timezone) || undefined;
}

export function formatInZone(value: string | null | undefined, timeZone: string | null | undefined, options: Intl.DateTimeFormatOptions) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-US', { ...options, timeZone: timeZone || undefined });
}
