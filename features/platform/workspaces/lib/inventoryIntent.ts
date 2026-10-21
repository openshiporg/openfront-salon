export type InventoryIntent = { version: 1; actorId: string; productId: string; locationId: string; delta: number; reason: string; idempotencyKey: string };
export type InventoryAcknowledgement = { status: 'acknowledged'; movementId: string; balanceAfter: number } | { status: 'unverified' };
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
export function parseInventoryIntent(value: unknown, actorId: string, productId: string): InventoryIntent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Partial<InventoryIntent>;
  if (input.version !== 1 || !id(input.actorId) || input.actorId !== actorId || !id(input.productId) || input.productId !== productId
    || !id(input.locationId) || !Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta!) > 1_000_000
    || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500
    || !id(input.idempotencyKey) || input.idempotencyKey.length < 12) return null;
  return { version: 1, actorId, productId, locationId: input.locationId, delta: input.delta!, reason: input.reason, idempotencyKey: input.idempotencyKey };
}
export function inventoryAcknowledgement(value: unknown): InventoryAcknowledgement {
  if (!value || typeof value !== 'object') return { status: 'unverified' };
  const result = value as { success?: unknown; movementId?: unknown; balanceAfter?: unknown };
  return result.success === true && id(result.movementId) && Number.isSafeInteger(result.balanceAfter) && Number(result.balanceAfter) >= 0 && Number(result.balanceAfter) <= 2147483647
    ? { status: 'acknowledged', movementId: result.movementId, balanceAfter: Number(result.balanceAfter) } : { status: 'unverified' };
}
/** Save and verify exact owned bytes BEFORE calling the server. A foreign/malformed record is never removed. */
export function saveInventoryIntent(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, input: InventoryIntent): boolean {
  const bytes = JSON.stringify(input);
  try {
    const existing = storage.getItem(key);
    if (existing !== null && existing !== bytes) return false;
    storage.setItem(key, bytes);
    return storage.getItem(key) === bytes;
  } catch { return false; }
}

/** Browser's actual dispatch seam: failed storage means zero NEW server calls. */
export async function submitInventoryIntent(
  storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, input: InventoryIntent,
  send: (intent: InventoryIntent) => Promise<InventoryAcknowledgement>, onSaved: () => void = () => {},
): Promise<InventoryAcknowledgement | { status: 'storage-unverified' }> {
  if (!saveInventoryIntent(storage, key, input)) return { status: 'storage-unverified' };
  try { onSaved(); return await send(input); } catch { return { status: 'unverified' }; }
}

export function releaseAcknowledgedIntent(
  storage: Pick<Storage, 'getItem' | 'removeItem'>, key: string, input: InventoryIntent, ack: InventoryAcknowledgement | null,
): boolean {
  if (ack?.status !== 'acknowledged' || inventoryAcknowledgement({ success: true, ...ack }).status !== 'acknowledged') return false;
  try {
    if (storage.getItem(key) !== JSON.stringify(input)) return false;
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch { return false; }
}
