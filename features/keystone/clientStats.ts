/**
 * Client visit stats are derived, never incremented. They are stored on the
 * Client so lists can sort and filter by them, but every write recomputes them
 * from the source rows, using the same rule as the client profile:
 *
 *   totalVisits / firstVisit / lastVisit - completed appointments, by start time
 *   lifetimeValue - completed sales' pre-tax spend, less posted reversals
 */
type VisitRow = { status?: string | null; startTime?: string | Date | null };
type SaleRow = {
  status?: string | null;
  metadata?: unknown;
  lineItems?: Array<{ unitPrice?: number | null; quantity?: number | null; discount?: number | null }> | null;
  reversals?: Array<{ subtotalDelta?: number | null }> | null;
};
export type ClientStats = { totalVisits: number; firstVisit: string | null; lastVisit: string | null; lifetimeValue: number };

const iso = (value: string | Date) => new Date(value).toISOString();

/** Pre-tax spend of one sale: the settled taxable amount, or its line items when an older sale has no settlement. */
function saleSpend(sale: SaleRow) {
  const taxable = sale.metadata && typeof sale.metadata === "object" ? Number((sale.metadata as Record<string, unknown>).taxable) : NaN;
  if (Number.isFinite(taxable)) return taxable;
  return (sale.lineItems || []).reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0) - Number(line.discount || 0), 0);
}

export function clientStatsFrom(appointments: VisitRow[], sales: SaleRow[]): ClientStats {
  const visits = appointments
    .filter((item) => item.status === "completed" && item.startTime && !Number.isNaN(new Date(item.startTime).getTime()))
    .map((item) => iso(item.startTime!))
    .sort();
  const lifetimeValue = sales
    .filter((sale) => sale.status === "completed")
    .reduce((sum, sale) => sum + saleSpend(sale) - (sale.reversals || []).reduce((total, item) => total + Math.abs(Number(item.subtotalDelta || 0)), 0), 0);
  return { totalVisits: visits.length, firstVisit: visits[0] || null, lastVisit: visits.at(-1) || null, lifetimeValue: Math.max(0, Math.round(lifetimeValue)) };
}

/** Recompute and store one client's stats inside the caller's transaction. */
export async function recomputeClientStats(sudo: any, clientId: string | null | undefined) {
  if (!clientId) return null;
  const [appointments, sales] = await Promise.all([
    sudo.query.Appointment.findMany({ where: { client: { id: { equals: clientId } }, status: { equals: "completed" } }, take: 10000, query: "status startTime" }),
    sudo.query.SalonTransaction.findMany({ where: { client: { id: { equals: clientId } }, status: { equals: "completed" } }, take: 10000, query: "status metadata lineItems { unitPrice quantity discount } reversals { subtotalDelta }" }),
  ]);
  const stats = clientStatsFrom(appointments, sales);
  await sudo.query.Client.updateOne({ where: { id: clientId }, data: stats, query: "id" });
  return stats;
}
