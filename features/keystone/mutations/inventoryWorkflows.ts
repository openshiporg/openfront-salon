import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { serializableWorkflow } from "./serializableWorkflow";
import { currentStockContext, assertStockLocation, assertCheckoutLocation } from "../inventory/locationAuthority";
import { originalMovementResult, receiptMetadata } from "../inventory/movementReceipt";
import { acquireStockLedgerFences, registerStockTransaction, isStockTransaction } from "../inventory/stockFences";

type InventoryResult = { success: boolean; movementId: string | null; balanceAfter: number | null; error: string | null };
type AdjustmentInput = { productId: string; locationId: string; delta: number; reason: string; idempotencyKey: string };
const denied = { success: false, movementId: null, balanceAfter: null };
const INVENTORY_RECOVERY_DELAYS_MS = [0, 50, 150] as const;

function originalInventoryError(error: unknown) {
  return error instanceof Error ? error.message : "Inventory adjustment failed";
}

function opaqueProductLifecycleError(error: unknown) {
  return /Product\.hooks\.afterOperation: Prisma error/i.test(originalInventoryError(error));
}

export function completedInventoryAdjustmentReplay(movement: any, product: any, input: AdjustmentInput, currentLedgerQuantity?: number): InventoryResult | null {
  const expectedType = input.delta > 0 ? "receive" : "adjustment";
  const metadata = movement?.metadata && typeof movement.metadata === "object" ? movement.metadata : {};
  if (!movement?.id || movement.idempotencyKey !== input.idempotencyKey
    || movement.product?.id !== input.productId || movement.location?.id !== input.locationId
    || movement.type !== expectedType || movement.delta !== input.delta || movement.reason !== input.reason.trim()
    || movement.appointment != null
    || !Number.isSafeInteger(movement.balanceBefore) || !Number.isSafeInteger(movement.balanceAfter)
    || movement.balanceBefore < 0 || movement.balanceAfter < 0 || movement.balanceBefore + movement.delta !== movement.balanceAfter
    || !Number.isSafeInteger(metadata.aggregateQuantityBefore) || !Number.isSafeInteger(metadata.aggregateQuantityAfter)
    || metadata.aggregateQuantityBefore < 0 || metadata.aggregateQuantityAfter < 0
    || metadata.aggregateQuantityBefore + movement.delta !== metadata.aggregateQuantityAfter
    || product?.id !== input.productId || !Number.isSafeInteger(product.quantity) || product.quantity < 0
    || product.quantity !== (currentLedgerQuantity ?? metadata.aggregateQuantityAfter)) return null;
  return { success: true, movementId: movement.id, balanceAfter: movement.balanceAfter, error: null };
}

/** Read-only convergence check for an identical adjustment whose winner may still be committing. */
export async function recoverCompletedInventoryAdjustment(
  context: Context,
  input: AdjustmentInput,
  delaysMs: readonly number[] = INVENTORY_RECOVERY_DELAYS_MS,
): Promise<InventoryResult | null> {
  for (const delayMs of delaysMs.slice(0, INVENTORY_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      await assertStockLocation(context, input.locationId, "adjust");
      const sudo = context.sudo();
      const movements = await sudo.query.InventoryMovement.findMany({
        where: { idempotencyKey: { equals: input.idempotencyKey } }, take: 2,
        query: "id idempotencyKey type delta balanceBefore balanceAfter reason metadata product { id } location { id } appointment { id }",
      });
      if (movements.length > 1) return null;
      if (movements.length === 1) {
        const metadata = receiptMetadata(movements[0].metadata);
        if ((metadata.stockActorId != null && metadata.stockActorId !== context.session?.itemId)
          || (metadata.stockPurpose != null && metadata.stockPurpose !== "adjust")) return null;
        const [product, aggregate] = await Promise.all([
          sudo.query.Product.findOne({ where: { id: input.productId }, query: "id quantity" }),
          context.prisma.inventoryMovement.aggregate({ where: { productId: input.productId }, _sum: { delta: true } }),
        ]);
        if (!Number.isSafeInteger(aggregate._sum.delta) || aggregate._sum.delta! < 0) return null;
        const result = completedInventoryAdjustmentReplay(movements[0], product, input, aggregate._sum.delta!);
        if (!result) return null;
        await assertStockLocation(context, movements[0].location!.id, "adjust");
        return result;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function classifiedInventoryAdjustmentError(error: unknown, recovered: InventoryResult | null) {
  return opaqueProductLifecycleError(error) && recovered ? recovered : { ...denied, error: originalInventoryError(error) };
}

function validKey(value: string) {
  return value.trim().length >= 12 && value.length <= 200;
}

export async function recordInventoryMovement(context: Context, input: {
  productId: string;
  locationId: string;
  appointmentId?: string | null;
  type: "receive" | "adjustment" | "sale" | "return";
  delta: number;
  reason: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  purpose?: "onboarding";
}): Promise<InventoryResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 1_000_000) {
    return { ...denied, error: "Inventory delta must be a non-zero integer" };
  }
  if (!validKey(input.idempotencyKey)) return { ...denied, error: "Inventory idempotency key is invalid" };
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) return { ...denied, error: "Inventory reason is required" };

  const purpose = input.purpose === "onboarding" ? "onboarding" : input.type === "sale" ? "checkout" : input.type === "return" ? "return" : "adjust";
  {
    if ((!["sale", "return"].includes(input.type) && input.appointmentId) || (input.type === "sale" && (input.delta > 0 || !input.appointmentId))
      || (input.type === "return" && (input.delta < 0 || !input.appointmentId || !input.metadata?.reversalId || !input.metadata?.sourceLineId))
      || (input.type === "receive" && input.delta < 0)) return { ...denied, error: "Inventory purpose and parent input differ" };
    try {
      await assertStockLocation(context, input.locationId, purpose);
      if (isStockTransaction(context)) await acquireStockLedgerFences(context, [input], [input.idempotencyKey]);
    } catch { return { ...denied, error: "Current inventory authority could not be verified" }; }
  }
  const sudo = context.sudo();
  const existingRows = await sudo.query.InventoryMovement.findMany({
    where: { idempotencyKey: { equals: input.idempotencyKey } }, take: 2,
    query: "id idempotencyKey type delta balanceBefore balanceAfter reason metadata product { id } location { id } appointment { id }",
  });
  if (existingRows.length) {
    const existing = existingRows[0];
    const result = existingRows.length === 1 ? originalMovementResult(existing, input) : null;
    if (!result) return { ...denied, error: "Inventory idempotency key was reused for another or incomplete movement" };
    try {
      await assertStockLocation(context, existing.location.id, purpose);
      const metadata = receiptMetadata(existing.metadata);
      if ((metadata.source === "onboarding") !== (purpose === "onboarding")
        || (metadata.stockActorId != null && metadata.stockActorId !== context.session?.itemId)
        || (metadata.stockPurpose != null && metadata.stockPurpose !== purpose)) throw new Error("Original stock actor or purpose differs");
      if (input.type === "sale") {
        if (typeof metadata.transactionId !== "string") throw new Error("Original sale lineage is unavailable");
        const lines = await sudo.query.SalonTransactionLineItem.findMany({
          where: { transaction: { id: { equals: metadata.transactionId } }, product: { id: { equals: existing.product.id } } }, take: 2,
          query: "id quantity product { id } transaction { id location { id } appointment { id } }",
        });
        if (lines.length !== 1 || lines[0].quantity !== -existing.delta || lines[0].product?.id !== existing.product.id
          || (metadata.sourceLineId != null && lines[0].id !== metadata.sourceLineId) || lines[0].transaction?.id !== metadata.transactionId
          || lines[0].transaction?.location?.id !== existing.location.id || lines[0].transaction?.appointment?.id !== existing.appointment?.id) throw new Error("Original sale lineage differs");
      }
      const [product, ledger] = await Promise.all([
        sudo.query.Product.findOne({ where: { id: existing.product.id }, query: "id quantity" }),
        context.prisma.inventoryMovement.aggregate({ where: { productId: existing.product.id }, _sum: { delta: true } }),
      ]);
      if (!product || product.id !== existing.product.id || !Number.isSafeInteger(product.quantity) || product.quantity < 0
        || product.quantity !== ledger._sum.delta) throw new Error("Current aggregate ledger requires review");
      await assertStockLocation(context, existing.location.id, purpose);
      return result;
    } catch { return { ...denied, error: "Original inventory result could not be verified with current authority" }; }
  }
  {
    if (!isStockTransaction(context)) return { ...denied, error: "New stock writes require the native transaction workflow" };
    if (input.type === "sale") {
      const scope = input.appointmentId ? await assertCheckoutLocation(context, input.appointmentId) : null;
      if (!scope || scope.location.id !== input.locationId) return { ...denied, error: "Sale location does not belong to the appointment" };
    }
    if (purpose === "onboarding" && (input.type !== "receive" || input.delta <= 0 || input.appointmentId || input.metadata?.source !== "onboarding")) {
      return { ...denied, error: "Opening stock requires the explicit onboarding purpose" };
    }
  }

  const [product, location, locationLedger, aggregateLedger] = await Promise.all([
    sudo.query.Product.findOne({ where: { id: input.productId }, query: "id quantity isActive" }),
    sudo.query.Location.findOne({ where: { id: input.locationId }, query: "id isActive" }),
    // Authorized workflow + serializable transaction owns the ledger. Aggregate
    // deltas are independent of timestamp/commit ordering (including ties).
    context.prisma.inventoryMovement.aggregate({
      where: { productId: input.productId, locationId: input.locationId }, _sum: { delta: true },
    }),
    context.prisma.inventoryMovement.aggregate({ where: { productId: input.productId }, _sum: { delta: true } }),
  ]);
  if (!product || product.isActive === false) return { ...denied, error: "Product is unavailable" };
  if (!location || location.isActive === false) return { ...denied, error: "Location is unavailable" };
  if (!Number.isSafeInteger(product.quantity) || product.quantity < 0
    || product.quantity !== (aggregateLedger._sum.delta ?? 0)) return { ...denied, error: "Aggregate inventory requires explicit ledger review" };
  if (purpose === "onboarding" && (product.quantity !== 0 || (aggregateLedger._sum.delta ?? 0) !== 0)) return { ...denied, error: "Opening inventory already has stock evidence" };
  const balanceBefore = Number(locationLedger._sum.delta || 0);
  const balanceAfter = balanceBefore + input.delta;
  if (balanceAfter < 0) return { ...denied, error: "Location inventory cannot fall below zero" };
  const aggregateQuantity = Number(product.quantity || 0) + input.delta;
  if (aggregateQuantity < 0) return { ...denied, error: "Aggregate inventory cannot fall below zero" };
  if (!Number.isSafeInteger(balanceBefore) || balanceBefore < 0 || !Number.isSafeInteger(balanceAfter) || balanceAfter > 2147483647
    || !Number.isSafeInteger(aggregateQuantity) || aggregateQuantity > 2147483647) return { ...denied, error: "Inventory arithmetic is outside the supported range" };
  await assertStockLocation(context, input.locationId, purpose);
  if (input.type === "return") {
    const source = await sudo.query.SalonTransactionLineItem.findOne({ where: { id: String(input.metadata!.sourceLineId) }, query: "id quantity product { id } transaction { id location { id } appointment { id } }" });
    const reversal = await sudo.query.TransactionReversal.findOne({ where: { id: String(input.metadata!.reversalId) }, query: "id type transaction { id }" });
    if (!source || !reversal || reversal.type === "compensation" || reversal.transaction?.id !== source.transaction?.id || source.product?.id !== input.productId || source.transaction?.location?.id !== input.locationId || source.transaction?.appointment?.id !== input.appointmentId || source.quantity < input.delta) return { ...denied, error: "Return lineage does not match the source sale" };
  }

  await sudo.query.Product.updateOne({ where: { id: product.id }, data: { quantity: aggregateQuantity }, query: "id" });
  const movement = await sudo.query.InventoryMovement.createOne({
    data: {
      type: input.type, delta: input.delta, balanceBefore, balanceAfter, reason,
      idempotencyKey: input.idempotencyKey,
      product: { connect: { id: product.id } }, location: { connect: { id: location.id } },
      appointment: input.appointmentId ? { connect: { id: input.appointmentId } } : undefined,
      metadata: {
        ...(input.metadata || {}),
        stockActorId: context.session!.itemId, stockPurpose: purpose,
        aggregateQuantityBefore: Number(product.quantity || 0),
        aggregateQuantityAfter: aggregateQuantity,
      } as any,
    },
    query: "id",
  });
  return { success: true, movementId: movement.id, balanceAfter, error: null };
}

export async function adjustSalonInventoryTransaction(context: Context, input: AdjustmentInput): Promise<InventoryResult> {
  try { await currentStockContext(context, "adjust"); }
  catch { return { ...denied, error: "You must be an authorized salon operator" }; }
  try {
    return await serializableWorkflow(context, "salon-inventory", [
      `product:${input.productId}`, `location:${input.locationId}`, `idempotency:${input.idempotencyKey}`,
    ], async (transactionContext) => {
      registerStockTransaction(transactionContext);
      await acquireStockLedgerFences(transactionContext, [input], [input.idempotencyKey]);
      await assertStockLocation(transactionContext, input.locationId, "adjust");
      return recordInventoryMovement(transactionContext, {
        ...input, type: input.delta > 0 ? "receive" : "adjustment",
      });
    });
  } catch (error) {
    const recovered = opaqueProductLifecycleError(error)
      ? await recoverCompletedInventoryAdjustment(context, input)
      : null;
    return classifiedInventoryAdjustmentError(error, recovered);
  }
}

const resultType = graphql.object<InventoryResult>()({
  name: "SalonInventoryResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    movementId: graphql.field({ type: graphql.ID }),
    balanceAfter: graphql.field({ type: graphql.Int }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const adjustSalonInventory = graphql.field({
  type: resultType,
  args: {
    productId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    locationId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    delta: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    reason: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  resolve(_source, args, context: Context) { return adjustSalonInventoryTransaction(context, args); },
});
