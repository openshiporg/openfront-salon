export type SettlementLine = { id: string; amount: number; serviceId?: string | null };
export function cents(value: number, label = "Amount") {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error(`${label} must be nonnegative integer cents`);
  return value;
}
/** Deterministic allocation: exact sum, no negative line, independent of input ordering. */
export function allocateCents(amount: number, weights: Record<string, number>) {
  cents(amount);
  const entries = Object.entries(weights).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((sum, [, value]) => sum + cents(value), 0);
  if (amount > total) throw new Error("Adjustment exceeds eligible remaining value");
  const result: Record<string, number> = {};
  let remaining = amount;
  for (const [id, weight] of entries) {
    const share = total ? Number(BigInt(amount) * BigInt(weight) / BigInt(total)) : 0;
    result[id] = share; remaining -= share;
  }
  for (const [id, weight] of entries) if (remaining && result[id] < weight) { result[id]++; remaining--; }
  if (remaining !== 0) throw new Error("Allocation did not conserve cents");
  return result;
}
export function checkoutSettlement(input: {
  lines: SettlementLine[]; manualDiscount: number; membershipPercent: number; membershipServices: string[];
  packageAvailable: number; packageServices: string[]; depositAvailable: number; taxRate: number; tip: number;
}) {
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 1) throw new Error("Tax configuration must be between zero and one");
  if (!Number.isFinite(input.membershipPercent) || input.membershipPercent < 0 || input.membershipPercent > 100) throw new Error("Membership discount is invalid");
  const membershipIds = new Set(input.membershipServices), packageIds = new Set(input.packageServices);
  const membership: Record<string, number> = {}, remaining: Record<string, number> = {};
  for (const line of input.lines) {
    cents(line.amount);
    membership[line.id] = line.serviceId && membershipIds.has(line.serviceId) ? Math.round(line.amount * input.membershipPercent / 100) : 0;
    remaining[line.id] = line.amount - membership[line.id];
  }
  const manual = allocateCents(input.manualDiscount, remaining);
  const discounts: Record<string, number> = {}, packageWeights: Record<string, number> = {};
  for (const line of input.lines) {
    discounts[line.id] = membership[line.id] + manual[line.id];
    remaining[line.id] -= manual[line.id];
    packageWeights[line.id] = line.serviceId && packageIds.has(line.serviceId) ? remaining[line.id] : 0;
  }
  const subtotal = input.lines.reduce((sum, line) => sum + line.amount, 0);
  const discount = Object.values(discounts).reduce((sum, value) => sum + value, 0);
  const membershipDiscount = Object.values(membership).reduce((sum, value) => sum + value, 0);
  const taxable = subtotal - discount;
  const tax = cents(Math.round(taxable * input.taxRate)), tip = cents(input.tip);
  const packageCredit = Math.min(cents(input.packageAvailable), Object.values(packageWeights).reduce((sum, value) => sum + value, 0));
  const packageAllocations = allocateCents(packageCredit, packageWeights);
  const grossTotal = cents(taxable + tax + tip);
  const depositCredit = Math.min(cents(input.depositAvailable), grossTotal - packageCredit);
  const total = grossTotal - packageCredit - depositCredit;
  return { subtotal, taxable, discount, membershipDiscount, discounts, tax, tip, grossTotal, packageCredit, packageAllocations, depositCredit, total, unappliedDeposit: input.depositAvailable - depositCredit };
}
