import { originalMovementResult, receiptMetadata, type MovementReceipt } from '@/features/keystone/inventory/movementReceipt';
import { inventoryAcknowledgement, parseInventoryIntent, type InventoryIntent, type InventoryAcknowledgement } from './inventoryIntent';

type Ports = {
  currentActor: () => Promise<string | null>;
  adjust: (input: InventoryIntent) => Promise<unknown>;
  originalMovement: (movementId: string) => Promise<MovementReceipt | null>;
};
/** Actual server-action seam: native transport supplies all ports, not an alternate backend. */
export async function executeInventoryIntent(input: InventoryIntent, ports: Ports): Promise<InventoryAcknowledgement> {
  const unverified = { status: 'unverified' as const };
  try {
    const actor = await ports.currentActor();
    if (!actor || !input || input.actorId !== actor || !parseInventoryIntent(input, actor, input.productId)) return unverified;
    const ack = inventoryAcknowledgement(await ports.adjust(input));
    if (ack.status !== 'acknowledged') return unverified;
    // A success-looking mutation DTO is not proof of the owned original result.
    // Normal generated ledger access must still prove CURRENT role/location.
    const movement = await ports.originalMovement(ack.movementId);
    if (!movement || movement.id !== ack.movementId || receiptMetadata(movement.metadata).stockActorId !== actor
      || receiptMetadata(movement.metadata).stockPurpose !== 'adjust') return unverified;
    const original = originalMovementResult(movement, { ...input, type: input.delta > 0 ? 'receive' : 'adjustment' });
    return original && original.balanceAfter === ack.balanceAfter ? ack : unverified;
  } catch { return unverified; }
}
