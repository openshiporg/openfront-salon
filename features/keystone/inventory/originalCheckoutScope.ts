import type { Context } from '.keystone/types';
import { currentStockContext, assertStockLocation } from './locationAuthority';

/** Normal ID/parent-only lineage read precedes location authorization and private JSON/result reads. */
export async function originalCheckoutScope(context: Context, appointmentId: string, idempotencyKey: string) {
  const current = await currentStockContext(context, 'checkout');
  const rows = await current.query.PaymentSession.findMany({
    where: { idempotencyKey: { equals: idempotencyKey } }, take: 2,
    query: 'id appointment { id transaction { id location { id } } }',
  });
  if (!rows.length) return null; // Absence alone is NOT a no-effect/rollback claim.
  const parent = rows[0].appointment?.transaction;
  if (rows.length !== 1 || !rows[0].id || rows[0].appointment?.id !== appointmentId || !parent?.id || !parent.location?.id) throw new Error('Original checkout lineage is unavailable');
  const scope = await assertStockLocation(current, parent.location.id, 'checkout');
  // Do not fetch the provider-bearing JSON until ORIGINAL location permission is proved.
  const originals = await scope.context.query.PaymentSession.findMany({
    where: { id: { equals: rows[0].id } }, take: 2,
    query: 'id data appointment { id transaction { id location { id } } }',
  });
  const original = originals[0];
  if (originals.length !== 1 || original.id !== rows[0].id || original.appointment?.id !== appointmentId
    || original.appointment?.transaction?.id !== parent.id || original.appointment?.transaction?.location?.id !== parent.location.id) throw new Error('Original checkout parent changed');
  const data = original.data && typeof original.data === 'object' && !Array.isArray(original.data) ? original.data as Record<string, unknown> : {};
  if ((data.originalTransactionId != null && data.originalTransactionId !== parent.id)
    || (data.originalLocationId != null && data.originalLocationId !== parent.location.id)
    || (data.stockActorId != null && data.stockActorId !== current.session?.itemId)) throw new Error('Original checkout lineage or actor differs');
  await assertStockLocation(context, parent.location.id, 'checkout');
  return { ...scope, transactionId: parent.id };
}
