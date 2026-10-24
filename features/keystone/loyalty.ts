import type { Context } from ".keystone/types";

type Tier = { name: string; minPoints: number };

function tiersOf(value: unknown): Tier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tier: any) => typeof tier?.name === "string" && Number.isFinite(Number(tier?.minPoints)) ? [{ name: tier.name, minPoints: Number(tier.minPoints) }] : [])
    .sort((a, b) => a.minPoints - b.minPoints);
}

export async function activeLoyaltyProgram(sudo: ReturnType<Context["sudo"]>) {
  return (await sudo.query.LoyaltyProgram.findMany({ where: { isActive: { equals: true } }, orderBy: { createdAt: "asc" }, take: 1, query: "id name pointsPerDollar redemptionRate tiers" }))[0] || null;
}

/** Points earned on a paid service subtotal (cents), rounded down. */
export function pointsForSpend(program: { pointsPerDollar?: number | null } | null, cents: number) {
  if (!program || !Number.isFinite(cents) || cents <= 0) return 0;
  return Math.floor((cents / 100) * Number(program.pointsPerDollar || 0));
}

/**
 * Appends one ledger entry to the client's points record and recomputes the tier.
 * Balances never go below zero.
 */
export async function postPoints(
  sudo: ReturnType<Context["sudo"]>,
  userId: string,
  delta: number,
  entry: { reason: string; source: string; reference?: string | null; actorId?: string | null },
) {
  if (!Number.isInteger(delta) || delta === 0) return null;
  const program = await activeLoyaltyProgram(sudo);
  const existing = (await sudo.query.ClientPoints.findMany({ where: { client: { id: { equals: userId } } }, take: 1, query: "id points transactions" }))[0];
  const ledger = Array.isArray(existing?.transactions) ? existing.transactions : [];
  if (entry.reference && ledger.some((item: any) => item?.reference === entry.reference)) return existing;
  const points = Math.max(0, Number(existing?.points || 0) + delta);
  if (delta < 0 && Number(existing?.points || 0) + delta < 0) throw new Error("Not enough points");
  const tier = tiersOf(program?.tiers).filter((item) => points >= item.minPoints).at(-1)?.name || "bronze";
  const transactions = [...ledger, { at: new Date().toISOString(), points: delta, balance: points, ...entry }].slice(-500);
  return existing
    ? sudo.query.ClientPoints.updateOne({ where: { id: existing.id }, data: { points, tier, transactions }, query: "id points tier" })
    : sudo.query.ClientPoints.createOne({ data: { client: { connect: { id: userId } }, points, tier, transactions }, query: "id points tier" });
}
