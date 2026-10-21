import type { Context } from '.keystone/types';

// Only native transaction callbacks register their Context. withSession/sudo is
// not a transaction grant; read-only original ACKs do not need this write grant.
const stockTransactions = new WeakSet<Context>();
export function registerStockTransaction(context: Context) { stockTransactions.add(context); }
export function isStockTransaction(context: Context) { return stockTransactions.has(context); }

/** Participating callers must use their active transaction Context. Not a transaction itself. */
export async function acquireStockLedgerFences(context: Context, resources: { productId: string; locationId: string }[] = [], receipts: string[] = []) {
  // A singleton-writer fence precedes late-discovered/new seed product IDs,
  // avoiding lock-order inversion between seed opening stock and retail pages.
  const keys = ['!writers', ...resources.flatMap(({ productId, locationId }) => [
    `product:${productId}`, `product-location:${JSON.stringify([productId, locationId])}`,
  ]), ...receipts.map(key => `receipt:${key}`)];
  for (const key of [...new Set(keys)].sort()) {
    await context.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'salon-stock-ledger', key);
  }
}
