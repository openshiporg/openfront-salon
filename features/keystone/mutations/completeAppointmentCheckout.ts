import { createHash } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { confirmProviderPayment, createProviderPaymentSession, paymentProviderFromRecord } from "../utils/paymentProviderAdapter";
import { assertServiceDayOpen } from "../appointmentTiming";
import { serializableWorkflow } from "./serializableWorkflow";
import { recordInventoryMovement } from "./inventoryWorkflows";
import { currentStockContext, assertCheckoutLocation } from "../inventory/locationAuthority";
import { acquireStockLedgerFences, registerStockTransaction } from "../inventory/stockFences";
import { originalCheckoutScope } from "../inventory/originalCheckoutScope";
import { checkoutSettlement } from "../settlement";
import { assertNoUnreconciledPackageUsage } from "../checkoutBoundaries";
import { assertNoUnresolvedAppointmentPaymentSessions } from "../depositBoundaries";

const TAX_RATE = Number.parseFloat(process.env.TAX_RATE || "0.08");

type CheckoutResult = { success: boolean; transactionId: string | null; paymentId: string | null; error: string | null };

type RetailInput = { productId: string; quantity: number };

const CHECKOUT_RECOVERY_DELAYS_MS = [0, 50, 150] as const;

export function checkoutRequestHash(args: {
  appointmentId: string; paymentMethod: string; tipAmount: number; discountAmount: number;
  clientPackageId?: string | null; clientMembershipId?: string | null;
}, retail: RetailInput[]) {
  return createHash("sha256").update(JSON.stringify({
    appointmentId: args.appointmentId, paymentMethod: args.paymentMethod, tipAmount: args.tipAmount, discountAmount: args.discountAmount,
    clientPackageId: args.clientPackageId || null, clientMembershipId: args.clientMembershipId || null,
    retail: [...retail].sort((left, right) => left.productId.localeCompare(right.productId)),
  })).digest("hex");
}

function completedCheckoutResult(session: any, appointmentId: string, requestHash: string, scope: { transactionId: string; location: { id: string } }): CheckoutResult | null {
  const payment = session?.payment;
  const appointment = session?.appointment;
  const transaction = appointment?.transaction;
  const paymentTransaction = payment?.appointment?.transaction;
  if (!session || session.status !== "completed" || !session.completedAt || session.data?.source !== "controlled_checkout" || session.data?.checkoutRequestHash !== requestHash
    || appointment?.id !== appointmentId || appointment.status !== "completed"
    || !transaction?.id || transaction.status !== "completed" || transaction.paymentStatus !== "paid" || !transaction.completedAt
    || !payment?.id || payment.status !== "completed" || !payment.processedAt
    || payment.session?.id !== session.id || payment.appointment?.id !== appointmentId
    || paymentTransaction?.id !== transaction.id || transaction.id !== scope.transactionId || transaction.location?.id !== scope.location.id
    || (session.data?.originalTransactionId != null && session.data.originalTransactionId !== transaction.id)
    || (session.data?.originalLocationId != null && session.data.originalLocationId !== transaction.location.id)
    || !Number.isInteger(session.amount) || !Number.isInteger(payment.totalAmount) || session.amount !== payment.totalAmount) return null;
  return { success: true, transactionId: transaction.id, paymentId: payment.id, error: null };
}

/**
 * A concurrent winner may commit after this request's transaction has already
 * surfaced a wrapped error. Recover only the exact, fully committed checkout
 * graph for this appointment/idempotency key; never infer success from a
 * generic error or a partial/mismatched row.
 */
export async function recoverCompletedCheckoutByIdempotency(
  context: Context,
  appointmentId: string,
  idempotencyKey: string,
  requestHash: string,
  delaysMs: readonly number[] = CHECKOUT_RECOVERY_DELAYS_MS,
): Promise<CheckoutResult | null> {
  for (const delayMs of delaysMs.slice(0, CHECKOUT_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const scope = await originalCheckoutScope(context, appointmentId, idempotencyKey);
      if (!scope) continue;
      const sessions = await context.sudo().query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: idempotencyKey } }, take: 2,
        query: `id idempotencyKey status amount completedAt data
          appointment { id status transaction { id status paymentStatus completedAt location { id } } }
          payment { id status totalAmount processedAt session { id } appointment { id transaction { id } } }
        `,
      });
      if (sessions.length > 0) return sessions.length === 1 ? completedCheckoutResult(sessions[0], appointmentId, requestHash, scope) : null;
    } catch {
      // Preserve the original transaction failure. A short bounded recheck is
      // allowed only because the concurrent winner may still be committing.
    }
  }
  return null;
}

function parseRetail(input: unknown): RetailInput[] {
  if (!Array.isArray(input)) return [];
  if (input.length > 50) throw new Error("Too many retail items");
  const quantities = new Map<string, number>();
  for (const item of input) {
    const productId = String((item as any)?.productId || "");
    const quantity = Number((item as any)?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000) throw new Error("Retail quantity is invalid");
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function completeAppointmentCheckoutTransaction(
  context: Context,
  args: {
    appointmentId: string; paymentMethod: string; tipAmount: number; discountAmount: number;
    retailItems?: unknown; clientPackageId?: string | null; clientMembershipId?: string | null; idempotencyKey: string;
  },
): Promise<CheckoutResult> {
  try { await currentStockContext(context, "checkout"); }
  catch { return { success: false, transactionId: null, paymentId: null, error: "You must be an authorized salon operator" }; }
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12) {
    return { success: false, transactionId: null, paymentId: null, error: "A valid idempotency key is required" };
  }
  let retail: RetailInput[];
  try {
    if (!["cash", "credit_card", "debit_card"].includes(args.paymentMethod)) throw new Error("Only cash or an already-collected external terminal payment can be recorded; gift cards require a supported allocated tender");
    retail = parseRetail(args.retailItems);
    if (!Number.isInteger(args.tipAmount) || !Number.isInteger(args.discountAmount)
      || args.tipAmount < 0 || args.discountAmount < 0 || args.tipAmount > 10_000_000 || args.discountAmount > 10_000_000) {
      throw new Error("Checkout amounts must be nonnegative integer cents");
    }
  } catch (error) {
    return { success: false, transactionId: null, paymentId: null, error: error instanceof Error ? error.message : "Invalid checkout input" };
  }

  const requestHash = checkoutRequestHash(args, retail);

  try {
    return await serializableWorkflow(context, "salon-domain-resource", [
      `appointment:${args.appointmentId}`,
      `checkout:${args.idempotencyKey}`,
      ...(args.clientPackageId ? [`package:${args.clientPackageId}`] : []),
      ...(args.clientMembershipId ? [`membership:${args.clientMembershipId}`] : []),
      ...retail.map((item) => `product:${item.productId}`),
    ], async (transactionContext) => {
      registerStockTransaction(transactionContext);
      await acquireStockLedgerFences(transactionContext);
      const originalScope = await originalCheckoutScope(transactionContext, args.appointmentId, args.idempotencyKey);
      const stockScope = originalScope || await assertCheckoutLocation(transactionContext, args.appointmentId);
      await acquireStockLedgerFences(transactionContext, retail.map(item => ({ productId: item.productId, locationId: stockScope.location.id })), retail.map(item => `${args.idempotencyKey}:inventory:${item.productId}`));
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 2,
        query: `id idempotencyKey status amount completedAt data
          appointment { id status transaction { id status paymentStatus completedAt location { id } } }
          payment { id status totalAmount processedAt session { id } appointment { id transaction { id } } }
        `,
      }));
      if (existing.length > 0) {
        const completed = existing.length === 1 && originalScope ? completedCheckoutResult(existing[0], args.appointmentId, requestHash, originalScope) : null;
        if (!completed) throw new Error("Checkout idempotency key is attached to an incomplete or mismatched settlement");
        return completed;
      }

      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: `
          id status startTime metadata depositAmount depositPaid payment { id } transaction { id } location { id name isActive timezone }
          client { id lifetimeValue totalVisits guestEmail homeLocation { id } user { id email } }
          stylist { id baseCommissionRate user { id } }
          lineItems { id serviceTitle serviceImagePath price quantity duration service { id } staff { id baseCommissionRate } }
        `,
      });
      if (!appointment) throw new Error("Appointment not found");
      const checkoutLocationId = stockScope.location.id;
      if (appointment.location?.id !== checkoutLocationId || appointment.location.isActive !== true) throw new Error("Appointment location is unavailable; reconcile its assignment before checkout");
      if (!['confirmed', 'in_progress'].includes(appointment.status || '')) throw new Error("Appointment is not eligible for checkout");
      assertServiceDayOpen(appointment.startTime, appointment.location?.timezone, "Checkout");
      if (appointment.payment?.id || appointment.transaction?.id) throw new Error("Appointment is already checked out");
      if (!appointment.lineItems.length) throw new Error("Appointment has no payable line items");
      const priorPackageUsage = await sudo.query.ClientPackageUsage.count({ where: { appointment: { id: { equals: appointment.id } } } });
      assertNoUnreconciledPackageUsage(priorPackageUsage);

      // A pending attempt can still complete; do not collect the full sale around it.
      const pendingPaymentSessions = await sudo.query.PaymentSession.findMany({
        where: {
          appointment: { id: { equals: appointment.id } },
          status: { in: ["pending", "requires_action", "authorized"] },
        },
        take: 100,
        query: "id status",
      });
      assertNoUnresolvedAppointmentPaymentSessions(pendingPaymentSessions);

      const products = retail.length ? await sudo.query.Product.findMany({
        where: { id: { in: retail.map((item) => item.productId) }, isActive: { equals: true } },
        query: "id name sku price quantity image { imagePath image { url } }",
      }) : [];
      const retailLines = retail.map((requested) => {
        const product = products.find((item: any) => item.id === requested.productId);
        if (!product || (product.quantity || 0) < requested.quantity) throw new Error("Retail product is unavailable");
        return { ...requested, product, unitPrice: product.price || 0 };
      });

      const serviceSubtotal = appointment.lineItems.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);
      const retailSubtotal = retailLines.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const bookedServiceIds = new Set(appointment.lineItems.map((item: any) => item.service?.id));
      let membershipPercent = 0;
      let membershipServices: string[] = [];
      if ((args.clientMembershipId || args.clientPackageId) && !appointment.client?.user?.id) throw new Error("Benefits require a verified linked client");
      if (args.clientMembershipId && appointment.client?.user?.id) {
        const membership = await sudo.query.ClientMembership.findOne({
          where: { id: args.clientMembershipId },
          query: "id status startDate pausedUntil client { id } membership { isActive discountPercent includedServices { id } }",
        });
        const paused = membership?.pausedUntil && new Date(membership.pausedUntil).getTime() > Date.now();
        if (!membership || membership.status !== "active" || paused || !membership.membership?.isActive || new Date(membership.startDate).getTime() > Date.now() || membership.client?.id !== appointment.client.user.id) throw new Error("Membership is not available for this client");
        if (!membership.membership?.includedServices?.some((service: any) => bookedServiceIds.has(service.id))) throw new Error("Membership does not cover this appointment");
        membershipPercent = membership.membership?.discountPercent || 0;
        membershipServices = membership.membership.includedServices.map((service: any) => service.id);
      }
      let packageAvailable = 0;
      let packageServices: string[] = [];
      let clientPackage: any = null;
      if (args.clientPackageId && appointment.client?.user?.id) {
        clientPackage = await sudo.query.ClientPackage.findOne({
          where: { id: args.clientPackageId },
          query: "id status totalValue usedValue expiresAt client { id } package { services { id } }",
        });
        if (!clientPackage || clientPackage.status !== "active" || (clientPackage.expiresAt && new Date(clientPackage.expiresAt).getTime() <= Date.now()) || clientPackage.client?.id !== appointment.client.user.id) throw new Error("Package is not available for this client");
        if (!clientPackage.package?.services?.some((service: any) => bookedServiceIds.has(service.id))) throw new Error("Package does not cover this appointment");
        packageAvailable = Math.max(0, (clientPackage.totalValue || 0) - (clientPackage.usedValue || 0));
        packageServices = clientPackage.package.services.map((service: any) => service.id);
      }
      const depositSessions = await sudo.query.PaymentSession.findMany({
        where: { appointment: { id: { equals: appointment.id } } }, take: 100,
        query: "id status data payment { id status totalAmount refundedAmount }",
      });
      const depositSources = depositSessions.filter((session: any) => session.data?.purpose === "appointment_deposit" && ["completed", "partially_refunded"].includes(session.payment?.status));
      const depositAvailable = depositSources.reduce((sum: number, session: any) => sum + Math.max(0, session.payment.totalAmount - (session.payment.refundedAmount || 0)), 0);
      if (appointment.depositPaid && !depositSources.length) throw new Error("Paid deposit has no captured payment evidence; reconcile it before checkout");
      const settlement = checkoutSettlement({
        lines: [...appointment.lineItems.map((item: any) => ({ id: item.id, amount: (item.price || 0) * (item.quantity || 1), serviceId: item.service?.id })),
          ...retailLines.map(item => ({ id: `retail:${item.productId}`, amount: item.unitPrice * item.quantity }))],
        manualDiscount: args.discountAmount, membershipPercent, membershipServices, packageAvailable, packageServices, depositAvailable, taxRate: TAX_RATE, tip: args.tipAmount,
      });
      const { subtotal, taxable, discount, packageCredit, tax, tip, depositCredit, total } = settlement;
      const now = new Date().toISOString();

      const transaction = await sudo.query.SalonTransaction.createOne({
        data: {
          type: "appointment", location: { connect: { id: checkoutLocationId } },
          client: appointment.client?.id ? { connect: { id: appointment.client.id } } : undefined,
          appointment: { connect: { id: appointment.id } }, staff: appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : undefined,
          tip, paymentMethod: packageCredit > 0 || depositCredit > 0 ? "split" : args.paymentMethod === "cash" ? "cash" : "card",
          paymentStatus: "paid", status: "completed", completedAt: now,
          metadata: { source: "controlled_checkout", settlementVersion: 2, currency: "USD", taxRate: TAX_RATE, serviceSubtotal, retailSubtotal, ...settlement, depositSources: depositSources.map((session: any) => ({ sessionId: session.id, available: session.payment.totalAmount - (session.payment.refundedAmount || 0) })) },
        }, query: "id",
      });

      for (const item of appointment.lineItems) {
        await sudo.query.SalonTransactionLineItem.createOne({
          data: {
            transaction: { connect: { id: transaction.id } }, itemType: "service",
            service: item.service?.id ? { connect: { id: item.service.id } } : undefined,
            staff: item.staff?.id ? { connect: { id: item.staff.id } } : appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : undefined,
            title: item.serviceTitle || item.service?.name || "Service", imagePath: item.serviceImagePath || "",
            quantity: item.quantity || 1, unitPrice: item.price || 0,
            discount: settlement.discounts[item.id],
            commissionRate: item.staff?.baseCommissionRate ?? appointment.stylist?.baseCommissionRate ?? 0,
            metadata: { snapshotType: "settled_service", title: item.serviceTitle, imagePath: item.serviceImagePath, duration: item.duration, packageCents: settlement.packageAllocations[item.id] || 0 },
          }, query: "id",
        });
      }
      for (const item of retailLines) {
        const imagePath = item.product.image?.image?.url || item.product.image?.imagePath || "";
        const retailLine = await sudo.query.SalonTransactionLineItem.createOne({
          data: {
            transaction: { connect: { id: transaction.id } }, itemType: "product",
            product: { connect: { id: item.product.id } }, staff: appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : undefined,
            title: item.product.name || "Product", sku: item.product.sku || "", imagePath,
            quantity: item.quantity, unitPrice: item.unitPrice, discount: settlement.discounts[`retail:${item.productId}`], commissionRate: 0,
            metadata: { snapshotType: "settled_product", title: item.product.name, sku: item.product.sku, imagePath },
          }, query: "id",
        });
        const movement = await recordInventoryMovement(transactionContext, {
          productId: item.product.id,
          locationId: checkoutLocationId,
          appointmentId: appointment.id,
          type: "sale",
          delta: -item.quantity,
          reason: `Retail sale at appointment checkout ${appointment.id}`,
          idempotencyKey: `${args.idempotencyKey}:inventory:${item.product.id}`,
          metadata: { source: "controlled_checkout", transactionId: transaction.id, sourceLineId: retailLine.id },
        });
        if (!movement.success) throw new Error(movement.error || "Inventory movement failed");
      }

      const providers = await sudo.query.PaymentProvider.findMany({
        where: { adapter: { equals: "manual" }, isInstalled: { equals: true } }, take: 1,
        query: "id code adapter config",
      });
      const provider = providers[0];
      if (!provider) throw new Error("Operator payment provider is unavailable");
      const providerConfig = paymentProviderFromRecord(provider as any);
      const initiated = await createProviderPaymentSession({ provider: providerConfig, amount: total, currency: "usd", idempotencyKey: args.idempotencyKey, metadata: { appointmentId: appointment.id, operatorId: context.session!.itemId } });
      const confirmed = await confirmProviderPayment({ provider: providerConfig, providerReference: initiated.providerReference, amount: total, idempotencyKey: `${args.idempotencyKey}:confirm` });
      if (confirmed.status !== "completed") throw new Error("Operator payment was not completed");
      const session = await sudo.query.PaymentSession.createOne({
        data: { appointment: { connect: { id: appointment.id } }, provider: { connect: { id: provider.id } }, idempotencyKey: args.idempotencyKey, amount: total, currency: "usd", status: "completed", providerReference: initiated.providerReference, completedAt: now, data: { ...(initiated.data || {}), ...(confirmed.data || {}), source: "controlled_checkout", checkoutRequestHash: requestHash, originalTransactionId: transaction.id, originalLocationId: checkoutLocationId, stockActorId: context.session!.itemId } },
        query: "id",
      });
      const payment = await sudo.query.Payment.createOne({
        data: { appointment: { connect: { id: appointment.id } }, session: { connect: { id: session.id } }, subtotal, tax, tip, discount, totalAmount: total, paymentMethod: args.paymentMethod, status: "completed", processedAt: now, processedBy: { connect: { id: context.session!.itemId } }, receiptEmail: appointment.client?.user?.email || appointment.client?.guestEmail || "", notes: "Recorded by controlled appointment checkout" },
        query: "id",
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });

      if (retailLines.length) {
        await sudo.query.ProductSale.createOne({
          data: { appointment: { connect: { id: appointment.id } }, products: retailLines.map((item) => ({ productId: item.product.id, name: item.product.name, sku: item.product.sku, quantity: item.quantity, price: item.unitPrice, subtotal: item.unitPrice * item.quantity })), total: retailSubtotal, soldBy: appointment.stylist?.user?.id ? { connect: { id: appointment.stylist.user.id } } : undefined },
          query: "id",
        });
      }
      for (const item of appointment.lineItems) {
        const stylistId = item.staff?.id || appointment.stylist?.id;
        const rate = item.staff?.baseCommissionRate ?? appointment.stylist?.baseCommissionRate ?? 0;
        if (!stylistId || !item.service?.id || rate <= 0) continue;
        const saleAmount = (item.price || 0) * (item.quantity || 1) - settlement.discounts[item.id];
        await sudo.query.Commission.createOne({ data: { stylist: { connect: { id: stylistId } }, service: { connect: { id: item.service.id } }, payment: { connect: { id: payment.id } }, saleAmount, commissionRate: rate, commissionAmount: Math.round(saleAmount * rate), isPaid: false, notes: "Generated by controlled checkout" }, query: "id" });
      }
      if (tip > 0) {
        const domain = sudo.query as any;
        const weights = new Map<string, number>();
        for (const item of appointment.lineItems) {
          const stylistId = item.staff?.id || appointment.stylist?.id;
          if (stylistId) weights.set(stylistId, (weights.get(stylistId) || 0) + (item.price || 0) * (item.quantity || 1));
        }
        const recipients = [...weights.entries()];
        if (recipients.length === 0) throw new Error("Tip cannot be conserved without an assigned practitioner");
        const totalWeight = recipients.reduce((sum, [, weight]) => sum + weight, 0); let allocated = 0;
        for (let index = 0; index < recipients.length; index += 1) {
          const [stylistId, weight] = recipients[index];
          const amount = index === recipients.length - 1 ? tip - allocated : Math.floor(tip * weight / Math.max(1, totalWeight));
          allocated += amount;
          await domain.GratuityLedgerEntry.createOne({ data: { payment: { connect: { id: payment.id } }, practitioner: { connect: { id: stylistId } }, type: "allocation",
            // Cash tips are handed to the stylist at the chair; only terminal (card) tips are owed through payroll.
            amountDelta: amount, payoutStatus: args.paymentMethod === "cash" ? "paid" : "payable", reason: "Controlled checkout gratuity allocation", actor: { connect: { id: context.session!.itemId } },
            postedAt: now, idempotencyKey: `${args.idempotencyKey}:tip:${stylistId}`, evidence: { allocationBasis: "service_line_value", totalTip: tip, weight, totalWeight, tender: args.paymentMethod === "cash" ? "cash" : "card", ...(args.paymentMethod === "cash" ? { paidOutAt: now, payoutReference: "Cash tip handed over at checkout" } : {}) } }, query: "id" });
        }
        if (allocated !== tip) throw new Error("Tip allocation failed cents conservation");
      }
      if (clientPackage && packageCredit > 0) {
        const usedValue = (clientPackage.usedValue || 0) + packageCredit;
        await sudo.query.ClientPackage.updateOne({ where: { id: clientPackage.id }, data: { usedValue, status: usedValue >= (clientPackage.totalValue || 0) ? "fully-used" : "active" }, query: "id" });
        const packageServiceIds = appointment.lineItems.reduce((ids: string[], item: any) => {
          const serviceId = item.service?.id;
          if ((settlement.packageAllocations[item.id] || 0) > 0 && typeof serviceId === "string" && !ids.includes(serviceId)) ids.push(serviceId);
          return ids;
        }, []);
        await sudo.query.ClientPackageUsage.createOne({ data: {
          clientPackage: { connect: { id: clientPackage.id } }, appointment: { connect: { id: appointment.id } },
          // A service relation is meaningful only when all allocated value maps
          // to exactly one service; per-line amounts remain on settled sale lines.
          service: packageServiceIds.length === 1 ? { connect: { id: packageServiceIds[0] } } : undefined,
          quantityUsed: 1, valueUsed: packageCredit, idempotencyKey: `${args.idempotencyKey}:package`,
        }, query: "id" });
      }
      if (appointment.client?.id) {
        await sudo.query.Client.updateOne({ where: { id: appointment.client.id }, data: { lifetimeValue: (appointment.client.lifetimeValue || 0) + taxable, totalVisits: (appointment.client.totalVisits || 0) + 1, lastVisit: now, ...(!appointment.client.homeLocation?.id && appointment.location?.id ? { homeLocation: { connect: { id: appointment.location.id } } } : {}) }, query: "id" });
      }
      const appointmentMetadata = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata as Record<string, any> : {};
      const transitionHistory = Array.isArray(appointmentMetadata.transitionHistory) ? appointmentMetadata.transitionHistory.slice(-49) : [];
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data: { status: "completed", metadata: { ...appointmentMetadata, transitionHistory: [...transitionHistory, { from: appointment.status, to: "completed", reason: "Checkout recorded", actorId: context.session!.itemId, at: now }] } }, query: "id" });
      const segments = await (sudo.query as any).AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["planned", "started"] } }, take: 200, query: "id" });
      for (const segment of segments) await (sudo.query as any).AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "completed" }, query: "id" });
      return { success: true, transactionId: transaction.id, paymentId: payment.id, error: null };
    });
  } catch (error) {
    const recovered = await recoverCompletedCheckoutByIdempotency(context, args.appointmentId, args.idempotencyKey, requestHash);
    if (recovered) return recovered;
    console.error("Controlled appointment checkout failed", error);
    return { success: false, transactionId: null, paymentId: null, error: error instanceof Error ? error.message : "Checkout failed" };
  }
}

const resultType = graphql.object<CheckoutResult>()({
  name: "CompleteAppointmentCheckoutResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    transactionId: graphql.field({ type: graphql.ID }), paymentId: graphql.field({ type: graphql.ID }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const completeAppointmentCheckout = graphql.field({
  type: resultType,
  args: {
    appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    tipAmount: graphql.arg({ type: graphql.nonNull(graphql.Int) }), discountAmount: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    retailItems: graphql.arg({ type: graphql.JSON }), clientPackageId: graphql.arg({ type: graphql.ID }), clientMembershipId: graphql.arg({ type: graphql.ID }),
    idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  resolve(_source, args, context: Context) { return completeAppointmentCheckoutTransaction(context, args); },
});
