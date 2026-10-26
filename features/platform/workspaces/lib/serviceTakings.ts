import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type ServiceTakingsRow = { label: string; count: number; net: number };

const rangeDays: Record<string, number> = { today: 0, week: 6, month: 29 };

/** Minutes the zone is ahead of UTC at `date`. */
function zoneOffset(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return (asUtc - date.getTime()) / 60_000;
}

/** Start of the report range on the salon calendar, matching the workspace report's own window. */
function rangeStart(range: string, timeZone = 'UTC') {
  const days = rangeDays[range];
  if (days === undefined) return null;
  try {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - days * 86_400_000));
    const [year, month, day] = key.split('-').map(Number);
    const guess = new Date(Date.UTC(year, month - 1, day));
    return new Date(guess.getTime() - zoneOffset(guess, timeZone) * 60_000).toISOString();
  } catch {
    return null;
  }
}

/**
 * Takings by service for the report period: settled payments' service lines,
 * net of line discounts. Read-only; returns null when the actor cannot read
 * payments or the query fails, so the report simply omits the table.
 */
export async function getServiceTakings(range: string, timeZone?: string): Promise<ServiceTakingsRow[] | null> {
  const since = rangeStart(range, timeZone);
  const where: Record<string, unknown> = { status: { in: ['completed', 'partially_refunded', 'refunded'] } };
  if (since) where.processedAt = { gte: since };
  const response = await keystoneClient<{ payments: Array<{ appointment?: { transaction?: { lineItems?: Array<{ itemType?: string | null; unitPrice?: number | null; quantity?: number | null; discount?: number | null; title?: string | null; service?: { name?: string | null } | null }> | null } | null } | null }> }>(`
    query ServiceTakings($where: PaymentWhereInput!) {
      payments(where: $where, take: 5000) {
        appointment { transaction { lineItems { itemType unitPrice quantity discount title service { name } } } }
      }
    }
  `, { where });
  if (!response.success) return null;
  const byService = new Map<string, ServiceTakingsRow>();
  for (const payment of response.data.payments || []) {
    for (const line of payment.appointment?.transaction?.lineItems || []) {
      if (line.itemType === 'product') continue;
      const label = line.service?.name || line.title || 'Service';
      const row = byService.get(label) || { label, count: 0, net: 0 };
      row.count += Number(line.quantity || 0);
      row.net += Number(line.unitPrice || 0) * Number(line.quantity || 0) - Number(line.discount || 0);
      byService.set(label, row);
    }
  }
  return [...byService.values()].sort((a, b) => b.net - a.net);
}
