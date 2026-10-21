import { createHash } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { currentStockContext, assertStockLocation } from "../inventory/locationAuthority";
import { refundProviderPayment, paymentProviderFromRecord } from "../utils/paymentProviderAdapter";
import { recordInventoryMovement } from "./inventoryWorkflows";
import { serializableWorkflow } from "./serializableWorkflow";
import { acquireStockLedgerFences, registerStockTransaction } from "../inventory/stockFences";

type LineInput = { lineItemId: string; quantity: number; inventoryDisposition: "not_applicable" | "return_to_stock" | "damaged" | "consumed" };
type ReversalResult = { success: boolean; reversalId: string | null; paymentDelta: number | null; error: string | null };
const denied = { success: false, reversalId: null, paymentDelta: null };
function domain(context: Context) { return context.sudo().query as any; }
function validKey(value: string) { return value.trim().length >= 12 && value.length <= 200; }
function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function parseLines(value: unknown): LineInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("Choose between 1 and 100 sale lines");
  const ids = new Set<string>();
  return value.map((raw: any) => {
    const item = { lineItemId: String(raw?.lineItemId || ""), quantity: Number(raw?.quantity), inventoryDisposition: raw?.inventoryDisposition || "not_applicable" } as LineInput;
    if (!item.lineItemId || ids.has(item.lineItemId) || !Number.isInteger(item.quantity) || item.quantity <= 0
      || !new Set(["not_applicable", "return_to_stock", "damaged", "consumed"]).has(item.inventoryDisposition)) throw new Error("Reversal line input is invalid");
    ids.add(item.lineItemId); return item;
  });
}

export async function reverseSalonTransactionTransaction(context: Context, args: {
  transactionId: string; type: "void" | "refund" | "partial_refund" | "compensation";
  lines: unknown; tipCents: number; restorePackageCents: number; reason: string; idempotencyKey: string;
}): Promise<ReversalResult> {
  if (!permissions.canIssueRefunds({ session: context.session as any })) return { ...denied, error: "You must have refund authority" };
  if (!validKey(args.idempotencyKey)) return { ...denied, error: "Reversal idempotency key is invalid" };
  const reason = args.reason.trim(); let requested: LineInput[];
  try { requested = parseLines(args.lines); } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Reversal input is invalid" }; }
  if (!reason || reason.length > 1000 || !Number.isInteger(args.tipCents) || args.tipCents < 0 || !Number.isInteger(args.restorePackageCents) || args.restorePackageCents < 0
    || !new Set(["void", "refund", "partial_refund"]).has(args.type)) return { ...denied, error: "Reversal amounts, type, or reason are invalid" };
  const requestHash = fingerprint({ transactionId: args.transactionId, type: args.type, requested, tipCents: args.tipCents, restorePackageCents: args.restorePackageCents, reason });

  try {
    // Commerce refund recovery pattern: reserve -> provider outside transaction -> post.
    const execute = async (phase: "prepare" | "post"): Promise<any> => serializableWorkflow(context, "salon-sale-reversal", [
      `transaction:${args.transactionId}`, `idempotency:${args.idempotencyKey}`,
      ...requested.map(item => `line:${item.lineItemId}`),
    ], async tx => {
      // Cookie role flags are not refund authority: re-read the actor's current role
      // in this attempt's transaction before any sudo read, replay, provider call or write.
      const current = await currentStockContext(tx, "return");
      registerStockTransaction(current);
      await acquireStockLedgerFences(current);
      const sudo = current.sudo(); const query = domain(current);
      const existing = (await query.TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id paymentDelta conservationEvidence transaction { id }" }))[0];
      if (existing) {
        if (existing.transaction?.id !== args.transactionId || existing.conservationEvidence?.requestHash !== requestHash) throw new Error("Idempotency key was reused for different reversal evidence");
        return { success: true, reversalId: existing.id, paymentDelta: existing.paymentDelta, error: null };
      }
      const transaction = await sudo.query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: `
        id status metadata completedAt location { id } client { id lifetimeValue }
        appointment { id payment { id status subtotal tax tip totalAmount refundedAmount session { id idempotencyKey providerReference provider { id code adapter config isInstalled } } }
          client { id } lineItems: lineItems { id } }
        lineItems { id itemType quantity unitPrice discount commissionRate service { id } product { id } staff { id } }
      ` });
      if (!transaction || transaction.status !== "completed" || !transaction.appointment?.payment) throw new Error("Only a completed controlled sale can be reversed");
      const payment = transaction.appointment.payment;
      if (!payment.session?.provider || !payment.session.providerReference) throw new Error("Payment provider evidence is unavailable");
      const sourceLines = new Map(transaction.lineItems.map((line: any) => [line.id, line]));
      const priorLines = await query.TransactionReversalLine.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1000, query: "quantity subtotalDelta taxDelta sourceLine { id }" });
      const calculated: Array<LineInput & { source: any; subtotalCents: number; taxCents: number }> = [];
      const originalNet = transaction.lineItems.reduce((sum: number, line: any) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0) - Number(line.discount || 0), 0);
      const priorSubtotal = priorLines.reduce((sum: number, line: any) => sum + Math.abs(Number(line.subtotalDelta || 0)), 0);
      const remainingNet = originalNet - priorSubtotal;
      for (const item of requested) {
        const source: any = sourceLines.get(item.lineItemId); if (!source) throw new Error("A reversal line does not belong to this transaction");
        const previous = priorLines.filter((line: any) => line.sourceLine?.id === source.id);
        const reversedQuantity = previous.reduce((sum: number, line: any) => sum + Number(line.quantity || 0), 0);
        const reversedCents = previous.reduce((sum: number, line: any) => sum + Math.abs(Number(line.subtotalDelta || 0)), 0);
        const remainingQuantity = Number(source.quantity || 0) - reversedQuantity;
        const sourceNet = Number(source.unitPrice || 0) * Number(source.quantity || 0) - Number(source.discount || 0);
        if (item.quantity > remainingQuantity) throw new Error("Reversal quantity exceeds the unreversed sale quantity");
        if (source.itemType === "product" && item.inventoryDisposition === "not_applicable") throw new Error("Retail reversals require an inventory disposition");
        if (source.itemType !== "product" && item.inventoryDisposition !== "not_applicable") throw new Error("Inventory disposition applies only to retail lines");
        const subtotalCents = item.quantity === remainingQuantity ? sourceNet - reversedCents : Math.floor(sourceNet * item.quantity / Number(source.quantity || 1));
        calculated.push({ ...item, source, subtotalCents, taxCents: 0 });
      }
      const requestedSubtotal = calculated.reduce((sum, line) => sum + line.subtotalCents, 0);
      if (requestedSubtotal <= 0 || requestedSubtotal > remainingNet) throw new Error("Reversal subtotal does not conserve the source sale");
      const priorReversals = await query.TransactionReversal.findMany({ where: { transaction: { id: { equals: transaction.id } } }, take: 1000, query: "taxDelta tipDelta paymentDelta commissionDelta" });
      const remainingTax = Number(payment.tax || 0) - priorReversals.reduce((sum: number, item: any) => sum + Math.abs(Number(item.taxDelta || 0)), 0);
      const remainingTip = Number(payment.tip || 0) - priorReversals.reduce((sum: number, item: any) => sum + Math.abs(Number(item.tipDelta || 0)), 0);
      if (args.tipCents > remainingTip) throw new Error("Tip recovery exceeds the unreversed gratuity");
      let requestedTax = requestedSubtotal === remainingNet ? remainingTax : Math.min(remainingTax, Math.floor(Number(payment.tax || 0) * requestedSubtotal / Math.max(1, originalNet)));
      let assignedTax = 0;
      calculated.forEach((line, index) => { line.taxCents = index === calculated.length - 1 ? requestedTax - assignedTax : Math.floor(requestedTax * line.subtotalCents / requestedSubtotal); assignedTax += line.taxCents; });
      const fullCommercialReversal = requestedSubtotal === remainingNet && requestedTax === remainingTax && args.tipCents === remainingTip;
      if ((args.type === "void" || args.type === "refund") && !fullCommercialReversal) throw new Error("Void and refund require the full remaining sale; use partial_refund for line-level recovery");
      if (args.type === "partial_refund" && fullCommercialReversal) throw new Error("Use refund or void for a full remaining sale reversal");
      const refundCents = requestedSubtotal + requestedTax + args.tipCents;
      const remainingPayment = Number(payment.totalAmount || 0) - Number(payment.refundedAmount || 0);
      const checkoutRefundCents = Math.min(refundCents, remainingPayment);
      const depositRefundCents = refundCents - checkoutRefundCents;
      const checkoutMetadata = transaction.metadata && typeof transaction.metadata === "object" ? transaction.metadata as Record<string, any> : {};
      const priorDepositAdjustments = await query.DepositAdjustment.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1000, query: "amountDelta" });
      const remainingDeposit = Number(checkoutMetadata.depositCredit || 0) - priorDepositAdjustments.reduce((sum: number, item: any) => sum + Math.abs(Number(item.amountDelta || 0)), 0);
      if (refundCents <= 0 || depositRefundCents > remainingDeposit) throw new Error("Payment reversal does not conserve captured checkout and deposit cents");
      const appointmentSessions = depositRefundCents > 0 ? await sudo.query.PaymentSession.findMany({
        where: { appointment: { id: { equals: transaction.appointment.id } } }, take: 50,
        query: "id status data providerReference idempotencyKey provider { id code adapter config isInstalled } payment { id status totalAmount refundedAmount }",
      }) : [];
      const depositSession: any = appointmentSessions.find((session: any) => session.id !== payment.session.id && session.data?.purpose === "appointment_deposit");
      if (depositRefundCents > 0 && (!depositSession?.provider || !depositSession.providerReference || !depositSession.payment)) throw new Error("Applied deposit payment evidence is unavailable");
      const providers = [
        ...(checkoutRefundCents > 0 ? [{ suffix: "checkout", provider: payment.session.provider, providerReference: payment.session.providerReference, amount: checkoutRefundCents }] : []),
        ...(depositRefundCents > 0 ? [{ suffix: "deposit", provider: depositSession.provider, providerReference: depositSession.providerReference, amount: depositRefundCents }] : []),
      ];
      // Validate all caller-controlled compensation BEFORE reserving/provider I/O.
      if (args.restorePackageCents > 0) {
        const usage = (await sudo.query.ClientPackageUsage.findMany({ where: { appointment: { id: { equals: transaction.appointment.id } } }, take: 1, query: "id valueUsed clientPackage { id usedValue }" }))[0];
        const adjustments = await query.ClientPackageAdjustment.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1000, query: "valueDelta" });
        const priorRestored = adjustments.reduce((sum: number, item: any) => sum + Math.max(0, -Number(item.valueDelta || 0)), 0);
        if (!usage?.clientPackage || args.restorePackageCents > requestedSubtotal || args.restorePackageCents + priorRestored > Number(checkoutMetadata.packageCredit || 0) || args.restorePackageCents + priorRestored > Number(usage.valueUsed || 0) || args.restorePackageCents > Number(usage.clientPackage.usedValue || 0)) throw new Error("Package restoration exceeds the remaining source usage");
      }
      if (args.tipCents > 0) {
        const tips = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "amountDelta" });
        if (tips.reduce((sum: number, item: any) => sum + Number(item.amountDelta || 0), 0) < args.tipCents) throw new Error("Tip recovery exceeds the conserved gratuity ledger");
      }
      for (const line of calculated) {
        if (line.inventoryDisposition !== "return_to_stock") continue;
        await assertStockLocation(current, transaction.location.id, "return");
        const product = await sudo.query.Product.findOne({ where: { id: line.source.product.id }, query: "id quantity isActive" });
        const balance = await current.prisma.inventoryMovement.aggregate({ where: { productId: line.source.product.id }, _sum: { delta: true } });
        if (!product?.isActive || product.quantity !== (balance._sum.delta ?? 0) || product.quantity + line.quantity > 2147483647) throw new Error("Return stock requires reconciliation before refund");
      }
      const providerHash = fingerprint(providers);
      const pending = checkoutMetadata.pendingSaleReversal;
      if (pending && (pending.key !== args.idempotencyKey || pending.requestHash !== requestHash)) throw new Error("An earlier sale reversal requires reconciliation with its original key");
      if (pending && pending.providerHash !== providerHash) throw new Error("Reserved refund provider or amount changed; reconciliation required");
      if (phase === "prepare") {
        // A durable reservation blocks other refund keys before any irreversible I/O.
        // Keep secrets out of transaction metadata: only the provider/config digest is stored.
        const operation = pending || { key: args.idempotencyKey, requestHash, providerHash, createdAt: new Date().toISOString(), results: {} };
        if (!pending) await sudo.query.SalonTransaction.updateOne({ where: { id: transaction.id }, data: { metadata: { ...checkoutMetadata, pendingSaleReversal: operation } }, query: "id" });
        return { prepared: true, providers, operation };
      }
      if (!pending) throw new Error("Durable refund reservation is missing");
      const providerResults = providers.map(step => pending.results?.[step.suffix]);
      if (providerResults.some((result, index) => !result || !["refunded", "completed"].includes(result.status) || result.amount !== providers[index].amount)) throw new Error("Provider refund is not verified; reconcile the original operation");
      const now = new Date().toISOString(); const fullyRefunded = checkoutRefundCents === remainingPayment;
      const commissions = await sudo.query.Commission.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "id saleAmount commissionAmount isPaid stylist { id } service { id } adjustments { amountDelta }" });
      let commissionDelta = 0;
      const commissionPlans: Array<{ commission: any; amount: number; sourceLineId: string }> = [];
      for (const line of calculated) {
        if (line.source.itemType !== "service") continue;
        const commission = commissions.find((item: any) => item.service?.id === line.source.service?.id && item.stylist?.id === line.source.staff?.id);
        if (!commission) continue;
        const priorAdjustment = commission.adjustments.reduce((sum: number, item: any) => sum + Number(item.amountDelta || 0), 0);
        const remainingCommission = Math.max(0, Number(commission.commissionAmount || 0) + priorAdjustment);
        const amount = Math.min(remainingCommission, Math.round(Number(commission.commissionAmount || 0) * line.subtotalCents / Math.max(1, Number(commission.saleAmount || 0))));
        if (amount > 0) { commissionDelta -= amount; commissionPlans.push({ commission, amount, sourceLineId: line.source.id }); }
      }
      const reversal = await query.TransactionReversal.createOne({ data: {
        transaction: { connect: { id: transaction.id } }, payment: { connect: { id: payment.id } }, type: args.type,
        status: providerResults.every(result => result.status === "completed" || result.status === "refunded") ? "posted" : "provider_pending",
        subtotalDelta: -requestedSubtotal, taxDelta: -requestedTax, tipDelta: -args.tipCents, paymentDelta: -refundCents, commissionDelta,
        reason, actor: { connect: { id: context.session!.itemId } }, providerReference: providerResults.map(result => typeof result.data?.refundId === "string" ? result.data.refundId : result.providerReference || "").join(","),
        idempotencyKey: args.idempotencyKey, postedAt: now,
        conservationEvidence: { requestHash, originalNet, priorSubtotal, remainingNet, paymentTotal: payment.totalAmount, priorRefunded: payment.refundedAmount, refundCents, checkoutRefundCents, depositRefundCents, remainingDeposit, remainingTax, remainingTip },
      }, query: "id" });
      for (const line of calculated) {
        let movementId: string | null = null;
        if (line.source.itemType === "product" && line.inventoryDisposition === "return_to_stock") {
          const movement = await recordInventoryMovement(current, { productId: line.source.product.id, locationId: transaction.location.id, appointmentId: transaction.appointment.id,
            type: "return", delta: line.quantity, reason: `Sale reversal ${reversal.id}: ${reason}`, idempotencyKey: `${args.idempotencyKey}:inventory:${line.source.id}`, metadata: { reversalId: reversal.id, sourceLineId: line.source.id } });
          if (!movement.success) throw new Error(movement.error || "Inventory reversal failed"); movementId = movement.movementId;
        }
        const lineCommission = commissionPlans.filter(plan => plan.sourceLineId === line.source.id).reduce((sum, plan) => sum + plan.amount, 0);
        await query.TransactionReversalLine.createOne({ data: { reversal: { connect: { id: reversal.id } }, sourceLine: { connect: { id: line.source.id } }, quantity: line.quantity,
          subtotalDelta: -line.subtotalCents, taxDelta: -line.taxCents, commissionDelta: -lineCommission, inventoryDisposition: line.inventoryDisposition,
          inventoryMovement: movementId ? { connect: { id: movementId } } : undefined, idempotencyKey: `${args.idempotencyKey}:line:${line.source.id}`,
          evidence: { sourceQuantity: line.source.quantity, sourceUnitPrice: line.source.unitPrice, sourceDiscount: line.source.discount } }, query: "id" });
      }
      for (const plan of commissionPlans) await query.CommissionAdjustment.createOne({ data: { commission: { connect: { id: plan.commission.id } }, reversal: { connect: { id: reversal.id } },
        amountDelta: -plan.amount, payablePeriod: plan.commission.isPaid ? "next_open_period_recovery" : "current_open_period", reason,
        actor: { connect: { id: context.session!.itemId } }, postedAt: now, idempotencyKey: `${args.idempotencyKey}:commission:${plan.commission.id}`,
        evidence: { paidSourceCommission: plan.commission.isPaid, sourceLineId: plan.sourceLineId } }, query: "id" });
      if (args.tipCents > 0) {
        const allocations = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "id amountDelta practitioner { id }" });
        const positive = allocations.filter((entry: any) => Number(entry.amountDelta) > 0); let assigned = 0;
        for (let index = 0; index < positive.length; index += 1) {
          const allocation = positive[index]; const amount = index === positive.length - 1 ? args.tipCents - assigned : Math.floor(args.tipCents * Number(allocation.amountDelta) / Math.max(1, Number(payment.tip)));
          assigned += amount; if (amount <= 0) continue;
          await query.GratuityLedgerEntry.createOne({ data: { payment: { connect: { id: payment.id } }, reversal: { connect: { id: reversal.id } }, practitioner: allocation.practitioner?.id ? { connect: { id: allocation.practitioner.id } } : undefined,
            type: "recovery", amountDelta: -amount, payoutStatus: "recovery_due", reason, actor: { connect: { id: context.session!.itemId } }, postedAt: now,
            idempotencyKey: `${args.idempotencyKey}:tip:${allocation.id}`, evidence: { sourceAllocationId: allocation.id } }, query: "id" });
        }
        if (assigned !== args.tipCents) throw new Error("Tip recovery cannot be allocated without conserved source gratuity entries");
      }
      if (depositRefundCents > 0) {
        const depositRefunded = Number(depositSession.payment.refundedAmount || 0) + depositRefundCents;
        await sudo.query.Payment.updateOne({ where: { id: depositSession.payment.id }, data: { refundedAmount: depositRefunded, status: depositRefunded >= Number(depositSession.payment.totalAmount || 0) ? "refunded" : "partially_refunded", refundedAt: now, refundReason: reason }, query: "id" });
        await query.DepositAdjustment.createOne({ data: { reversal: { connect: { id: reversal.id } }, paymentSession: { connect: { id: depositSession.id } }, amountDelta: -depositRefundCents,
          reason, actor: { connect: { id: context.session!.itemId } }, postedAt: now, idempotencyKey: `${args.idempotencyKey}:deposit`, evidence: { appliedDepositCredit: checkoutMetadata.depositCredit, priorDepositAdjustments: remainingDeposit - Number(checkoutMetadata.depositCredit || 0) } }, query: "id" });
      }
      if (args.restorePackageCents > 0) {
        if (args.restorePackageCents > requestedSubtotal || args.restorePackageCents > Number(checkoutMetadata.packageCredit || 0)) throw new Error("Package restoration exceeds the reversed package-funded value");
        const usage = (await sudo.query.ClientPackageUsage.findMany({ where: { appointment: { id: { equals: transaction.appointment.id } } }, take: 1, query: "id valueUsed clientPackage { id usedValue totalValue }" }))[0];
        if (!usage?.clientPackage || args.restorePackageCents > Number(usage.valueUsed || 0)) throw new Error("Package usage evidence is unavailable");
        const nextUsed = Math.max(0, Number(usage.clientPackage.usedValue || 0) - args.restorePackageCents);
        await sudo.query.ClientPackage.updateOne({ where: { id: usage.clientPackage.id }, data: { usedValue: nextUsed, status: "active" }, query: "id" });
        await query.ClientPackageAdjustment.createOne({ data: { clientPackage: { connect: { id: usage.clientPackage.id } }, reversal: { connect: { id: reversal.id } }, valueDelta: -args.restorePackageCents,
          reason, actor: { connect: { id: context.session!.itemId } }, postedAt: now, idempotencyKey: `${args.idempotencyKey}:package`, evidence: { sourceUsageId: usage.id } }, query: "id" });
      }
      const cumulativeRefund = Number(payment.refundedAmount || 0) + checkoutRefundCents;
      await sudo.query.Payment.updateOne({ where: { id: payment.id }, data: { refundedAmount: cumulativeRefund, status: fullyRefunded ? "refunded" : "partially_refunded", refundedAt: now, refundReason: reason }, query: "id" });
      if (transaction.client?.id) await sudo.query.Client.updateOne({ where: { id: transaction.client.id }, data: { lifetimeValue: Math.max(0, Number(transaction.client.lifetimeValue || 0) - checkoutRefundCents) }, query: "id" });
      await sudo.query.SalonTransaction.updateOne({ where: { id: transaction.id }, data: { metadata: { ...checkoutMetadata, pendingSaleReversal: null } }, query: "id" });
      return { success: true, reversalId: reversal.id, paymentDelta: -refundCents, error: null };
    });
    const prepared = await execute("prepare");
    if (!prepared.prepared) return prepared;
    for (const step of prepared.providers) {
      if (["refunded", "completed"].includes(prepared.operation.results?.[step.suffix]?.status)) continue;
      if (Date.now() - Date.parse(prepared.operation.createdAt) > 23 * 60 * 60 * 1000) throw new Error("Refund reservation requires provider reconciliation before retrying");
      const result = await refundProviderPayment({ provider: paymentProviderFromRecord(step.provider), providerReference: step.providerReference, amount: step.amount, idempotencyKey: `${args.idempotencyKey}:provider:${step.suffix}` });
      await serializableWorkflow(context, "salon-sale-reversal", [`transaction:${args.transactionId}`, `idempotency:${args.idempotencyKey}`], async tx => {
        const current = await currentStockContext(tx, "return");
        const sudo = current.sudo();
        const record = await sudo.query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: "id metadata" });
        const metadata = record?.metadata as any;
        const operation = metadata?.pendingSaleReversal;
        // Another same-key caller may already have posted this verified operation.
        if (!operation) {
          const posted = await domain(current).TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id conservationEvidence" });
          if (posted[0]?.conservationEvidence?.requestHash === requestHash) return;
          throw new Error("Refund reservation disappeared; reconciliation required");
        }
        if (operation.key !== args.idempotencyKey || operation.requestHash !== requestHash) throw new Error("Refund reservation identity changed");
        const observation = { status: result.status, amount: result.amount ?? null, providerReference: result.providerReference || null, data: { refundId: typeof result.data?.refundId === "string" ? result.data.refundId : null } };
        await sudo.query.SalonTransaction.updateOne({ where: { id: args.transactionId }, data: { metadata: { ...metadata, pendingSaleReversal: { ...operation, results: { ...operation.results, [step.suffix]: observation } } } }, query: "id" });
      });
      if (!["refunded", "completed"].includes(result.status) || result.amount !== step.amount) throw new Error("Refund is pending or mismatched; reconcile the original operation");
    }
    return await execute("post");
  } catch (error) {
    // A competing same-key caller may have committed while Keystone masked a
    // serialization failure in afterOperation. Read back only the exact receipt,
    // with fresh refund authority; never infer rollback or invent provider success.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await currentStockContext(context, "return");
        const rows = await domain(current).TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id status paymentDelta conservationEvidence transaction { id }" });
        const receipt = rows[0];
        if (receipt?.status === "posted" && receipt.transaction?.id === args.transactionId && receipt.conservationEvidence?.requestHash === requestHash) return { success: true, reversalId: receipt.id, paymentDelta: receipt.paymentDelta, error: null };
      } catch { break; }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 30));
    }
    return { ...denied, error: error instanceof Error ? error.message : "Sale reversal failed" };
  }
}

export async function adjustSaleCompensationTransaction(context: Context, args: {
  transactionId: string; commissionId?: string | null; commissionDelta: number; sourceGratuityEntryId?: string | null; targetPractitionerId?: string | null; gratuityTransferCents: number; reason: string; idempotencyKey: string;
}): Promise<ReversalResult> {
  if (!permissions.canManageCommissions({ session: context.session as any })) return { ...denied, error: "Compensation authority is required" };
  if (!validKey(args.idempotencyKey) || !args.reason.trim() || !Number.isInteger(args.commissionDelta) || !Number.isInteger(args.gratuityTransferCents) || args.gratuityTransferCents < 0
    || (!args.commissionId && args.commissionDelta !== 0) || (args.gratuityTransferCents > 0 && (!args.sourceGratuityEntryId || !args.targetPractitionerId))
    || (args.commissionDelta === 0 && args.gratuityTransferCents === 0)) return { ...denied, error: "Compensation adjustment input is invalid" };
  const requestHash = fingerprint({ transactionId: args.transactionId, commissionId: args.commissionId || null, commissionDelta: args.commissionDelta, sourceGratuityEntryId: args.sourceGratuityEntryId || null, targetPractitionerId: args.targetPractitionerId || null, gratuityTransferCents: args.gratuityTransferCents, reason: args.reason.trim() });
  try {
    return await serializableWorkflow(context, "salon-compensation-adjustment", [`transaction:${args.transactionId}`, `idempotency:${args.idempotencyKey}`], async tx => {
      const actor = await tx.query.User.findOne({ where: { id: context.session!.itemId }, query: "id role { id name canManageSalon canManageCommissions }" });
      if (!actor || !permissions.canManageCommissions({ session: { ...context.session, data: { ...context.session!.data, role: actor.role } } as any })) throw new Error("Current compensation authority is required");
      const query = domain(tx); const existing = (await query.TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id paymentDelta conservationEvidence transaction { id }" }))[0];
      if (existing) {
        if (existing.transaction?.id !== args.transactionId || existing.conservationEvidence?.requestHash !== requestHash) throw new Error("Idempotency key was reused for different compensation evidence");
        return { success: true, reversalId: existing.id, paymentDelta: 0, error: null };
      }
      const transaction = await tx.sudo().query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: "id appointment { payment { id } }" });
      if (!transaction?.appointment?.payment?.id) throw new Error("Settled transaction payment not found");
      let commission: any = null;
      if (args.commissionId) {
        commission = await tx.sudo().query.Commission.findOne({ where: { id: args.commissionId }, query: "id commissionAmount isPaid payment { id } adjustments { amountDelta }" });
        if (!commission || commission.payment?.id !== transaction.appointment.payment.id) throw new Error("Commission does not belong to the transaction payment");
        const adjusted = Number(commission.commissionAmount || 0) + commission.adjustments.reduce((sum: number, item: any) => sum + Number(item.amountDelta || 0), 0) + args.commissionDelta;
        if (adjusted < 0) throw new Error("Commission adjustment would create negative earnings");
      }
      let sourceTip: any = null;
      if (args.gratuityTransferCents > 0) {
        sourceTip = await query.GratuityLedgerEntry.findOne({ where: { id: args.sourceGratuityEntryId }, query: "id amountDelta payment { id } practitioner { id }" });
        if (!sourceTip || sourceTip.payment?.id !== transaction.appointment.payment.id || Number(sourceTip.amountDelta || 0) <= 0) throw new Error("Source gratuity allocation is invalid");
        const entries = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: sourceTip.payment.id } }, practitioner: { id: { equals: sourceTip.practitioner.id } } }, take: 500, query: "amountDelta" });
        if (entries.reduce((sum: number, item: any) => sum + Number(item.amountDelta || 0), 0) < args.gratuityTransferCents) throw new Error("Gratuity transfer exceeds the practitioner allocation");
      }
      const now = new Date().toISOString();
      const reversal = await query.TransactionReversal.createOne({ data: { transaction: { connect: { id: transaction.id } }, payment: { connect: { id: transaction.appointment.payment.id } }, type: "compensation", status: "posted",
        subtotalDelta: 0, taxDelta: 0, tipDelta: 0, paymentDelta: 0, commissionDelta: args.commissionDelta, reason: args.reason.trim(), actor: { connect: { id: context.session!.itemId } },
        idempotencyKey: args.idempotencyKey, postedAt: now, conservationEvidence: { requestHash, paymentDelta: 0, taxDelta: 0, tipTransferNet: 0, sourceCommissionId: args.commissionId || null } }, query: "id" });
      if (commission && args.commissionDelta !== 0) await query.CommissionAdjustment.createOne({ data: { commission: { connect: { id: commission.id } }, reversal: { connect: { id: reversal.id } }, amountDelta: args.commissionDelta,
        payablePeriod: commission.isPaid ? "next_open_period_adjustment" : "current_open_period", reason: args.reason.trim(), actor: { connect: { id: context.session!.itemId } }, postedAt: now,
        idempotencyKey: `${args.idempotencyKey}:commission`, evidence: { controlledCompensationCorrection: true } }, query: "id" });
      if (sourceTip) {
        for (const [suffix, practitionerId, delta, status] of [["debit", sourceTip.practitioner.id, -args.gratuityTransferCents, "recovery_due"], ["credit", args.targetPractitionerId, args.gratuityTransferCents, "payable"]] as const) {
          await query.GratuityLedgerEntry.createOne({ data: { payment: { connect: { id: sourceTip.payment.id } }, reversal: { connect: { id: reversal.id } }, practitioner: { connect: { id: practitionerId } },
            type: delta < 0 ? "recovery" : "allocation", amountDelta: delta, payoutStatus: status, reason: args.reason.trim(), actor: { connect: { id: context.session!.itemId } }, postedAt: now,
            idempotencyKey: `${args.idempotencyKey}:tip:${suffix}`, evidence: { transferPair: args.idempotencyKey, sourceEntryId: sourceTip.id } }, query: "id" });
        }
      }
      return { success: true, reversalId: reversal.id, paymentDelta: 0, error: null };
    });
  } catch (error) { return { ...denied, error: error instanceof Error ? error.message : "Compensation adjustment failed" }; }
}

const resultType = graphql.object<ReversalResult>()({ name: "SaleReversalResult", fields: {
  success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), reversalId: graphql.field({ type: graphql.ID }), paymentDelta: graphql.field({ type: graphql.Int }), error: graphql.field({ type: graphql.String }),
} });
export const adjustSaleCompensation = graphql.field({
  type: resultType,
  args: { transactionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), commissionId: graphql.arg({ type: graphql.ID }), commissionDelta: graphql.arg({ type: graphql.nonNull(graphql.Int) }), sourceGratuityEntryId: graphql.arg({ type: graphql.ID }), targetPractitionerId: graphql.arg({ type: graphql.ID }), gratuityTransferCents: graphql.arg({ type: graphql.nonNull(graphql.Int) }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve(_source, args, context: Context) { return adjustSaleCompensationTransaction(context, args); },
});

export const reverseSalonTransaction = graphql.field({
  type: resultType,
  args: { transactionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), type: graphql.arg({ type: graphql.nonNull(graphql.String) }), lines: graphql.arg({ type: graphql.nonNull(graphql.JSON) }), tipCents: graphql.arg({ type: graphql.nonNull(graphql.Int) }), restorePackageCents: graphql.arg({ type: graphql.nonNull(graphql.Int) }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve(_source, args, context: Context) { return reverseSalonTransactionTransaction(context, args as any); },
});
