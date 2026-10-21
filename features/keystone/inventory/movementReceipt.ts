export type MovementInput = {
  productId: string; locationId: string; appointmentId?: string | null;
  type: 'receive' | 'adjustment' | 'sale' | 'return'; delta: number; reason: string; idempotencyKey: string;
};
export type MovementReceipt = {
  id?: string; idempotencyKey?: string; type?: string; delta?: number; reason?: string;
  balanceBefore?: number; balanceAfter?: number; metadata?: unknown;
  product?: { id?: string } | null; location?: { id?: string } | null; appointment?: { id?: string } | null;
};
const units = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
export function receiptMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Historical arithmetic/identity, not current catalog eligibility or a new reservation. */
export function originalMovementResult(value: MovementReceipt, input: MovementInput) {
  const metadata = receiptMetadata(value.metadata);
  if (!value.id || value.idempotencyKey !== input.idempotencyKey || value.type !== input.type || value.delta !== input.delta
    || value.product?.id !== input.productId || value.location?.id !== input.locationId
    || (value.appointment?.id || null) !== (input.appointmentId || null) || value.reason !== input.reason.trim()
    || !units(value.balanceBefore) || !units(value.balanceAfter) || value.balanceBefore + input.delta !== value.balanceAfter
    || !units(metadata.aggregateQuantityBefore) || !units(metadata.aggregateQuantityAfter)
    || metadata.aggregateQuantityBefore + input.delta !== metadata.aggregateQuantityAfter) return null;
  return { success: true, movementId: value.id, balanceAfter: value.balanceAfter, error: null };
}
