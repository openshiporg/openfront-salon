import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { serializableWorkflow } from "./serializableWorkflow";

type Result = { success: boolean; recordId: string | null; error: string | null };
const denied = { success: false, recordId: null };
const TENDERS = new Set(["cash", "credit_card", "debit_card"]);

function authorized(context: Context) {
  const session = context.session as any;
  return permissions.canManageClients({ session }) && permissions.canManagePayments({ session });
}

/**
 * Sells a package or enrols a client in a membership at the desk. The tender is
 * collected in the salon; the sale is recorded as a completed Payment so it
 * shows in Reports, and the benefit is redeemable at checkout immediately.
 */
export async function sellClientBenefitTransaction(context: Context, args: {
  kind: string; planId: string; clientUserId: string; paymentMethod: string; idempotencyKey: string;
}): Promise<Result> {
  if (!authorized(context)) return { ...denied, error: "Client and payment authority are required" };
  if (!["package", "membership"].includes(args.kind)) return { ...denied, error: "Benefit type is invalid" };
  if (!TENDERS.has(args.paymentMethod)) return { ...denied, error: "Record cash or an external terminal payment" };
  if (args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) return { ...denied, error: "Operation key is invalid" };
  try {
    return await serializableWorkflow(context, "salon-benefit-sale", [`benefit:${args.idempotencyKey}`, `client:${args.clientUserId}`], async (tx) => {
      const sudo = tx.sudo();
      const replay = (await sudo.query.Payment.findMany({ where: { notes: { equals: `benefit-sale:${args.idempotencyKey}` } }, take: 1, query: "id" }))[0];
      if (replay) return { success: true, recordId: replay.id, error: null };
      const user = await sudo.query.User.findOne({ where: { id: args.clientUserId }, query: "id email" });
      if (!user) throw new Error("Client account not found");
      const now = new Date();
      let amount = 0;
      let recordId: string;
      if (args.kind === "package") {
        const plan = await sudo.query.ServicePackage.findOne({ where: { id: args.planId }, query: "id name totalPrice savingsAmount validDays isActive" });
        if (!plan || !plan.isActive) throw new Error("Package is not available");
        amount = Number(plan.totalPrice || 0);
        const expiresAt = plan.validDays ? new Date(now.getTime() + plan.validDays * 86_400_000).toISOString() : null;
        const record = await sudo.query.ClientPackage.createOne({ data: {
          client: { connect: { id: user.id } }, package: { connect: { id: plan.id } }, purchasedAt: now.toISOString(), expiresAt,
          status: "active", totalValue: amount + Number(plan.savingsAmount || 0), paidAmount: amount, usedValue: 0,
          metadata: { soldBy: context.session!.itemId, tender: args.paymentMethod, idempotencyKey: args.idempotencyKey },
        }, query: "id" });
        recordId = record.id;
      } else {
        const plan = await sudo.query.Membership.findOne({ where: { id: args.planId }, query: "id monthlyPrice isActive" });
        if (!plan || !plan.isActive) throw new Error("Membership plan is not available");
        const current = await sudo.query.ClientMembership.findMany({ where: { client: { id: { equals: user.id } }, membership: { id: { equals: plan.id } }, status: { in: ["active", "paused"] } }, take: 1, query: "id" });
        if (current.length) throw new Error("Client already has this membership");
        amount = Number(plan.monthlyPrice || 0);
        const next = new Date(now); next.setMonth(next.getMonth() + 1);
        const record = await sudo.query.ClientMembership.createOne({ data: {
          client: { connect: { id: user.id } }, membership: { connect: { id: plan.id } }, startDate: now.toISOString(), nextBillingDate: next.toISOString(), status: "active",
        }, query: "id" });
        recordId = record.id;
      }
      await sudo.query.Payment.createOne({ data: {
        subtotal: amount, tax: 0, tip: 0, discount: 0, totalAmount: amount, paymentMethod: args.paymentMethod, status: "completed",
        processedAt: now.toISOString(), processedBy: { connect: { id: context.session!.itemId } }, receiptEmail: user.email || "",
        notes: `benefit-sale:${args.idempotencyKey}`,
      }, query: "id" });
      return { success: true, recordId, error: null };
    });
  } catch (error) {
    return { ...denied, error: error instanceof Error ? error.message : "Benefit sale failed" };
  }
}

/** Pause, resume or cancel a client's membership, or cancel a package. */
export async function setClientBenefitStatusTransaction(context: Context, args: { kind: string; id: string; status: string; pausedUntil?: string | null }): Promise<Result> {
  if (!permissions.canManageClients({ session: context.session as any })) return { ...denied, error: "Client authority is required" };
  try {
    const sudo = context.sudo();
    if (args.kind === "membership") {
      if (!["active", "paused", "cancelled"].includes(args.status)) throw new Error("Membership status is invalid");
      const record = await sudo.query.ClientMembership.findOne({ where: { id: args.id }, query: "id status" });
      if (!record) throw new Error("Membership not found");
      if (record.status === "cancelled") throw new Error("A cancelled membership can't be changed");
      const pausedUntil = args.status === "paused" && args.pausedUntil ? new Date(args.pausedUntil) : null;
      if (pausedUntil && Number.isNaN(pausedUntil.getTime())) throw new Error("Pause date is invalid");
      await sudo.query.ClientMembership.updateOne({ where: { id: record.id }, data: { status: args.status, pausedUntil: pausedUntil ? pausedUntil.toISOString() : null }, query: "id" });
      return { success: true, recordId: record.id, error: null };
    }
    if (args.kind === "package") {
      if (args.status !== "cancelled") throw new Error("Packages can only be cancelled here");
      const record = await sudo.query.ClientPackage.findOne({ where: { id: args.id }, query: "id status" });
      if (!record) throw new Error("Package not found");
      if (record.status !== "active") throw new Error("Only an active package can be cancelled");
      await sudo.query.ClientPackage.updateOne({ where: { id: record.id }, data: { status: "cancelled" }, query: "id" });
      return { success: true, recordId: record.id, error: null };
    }
    throw new Error("Benefit type is invalid");
  } catch (error) {
    return { ...denied, error: error instanceof Error ? error.message : "Benefit update failed" };
  }
}

const resultType = graphql.object<Result>()({
  name: "ClientBenefitResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    recordId: graphql.field({ type: graphql.ID }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const sellClientBenefit = graphql.field({
  type: resultType,
  args: {
    kind: graphql.arg({ type: graphql.nonNull(graphql.String) }), planId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    clientUserId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), paymentMethod: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  resolve(_source, args, context: Context) { return sellClientBenefitTransaction(context, args); },
});

export const setClientBenefitStatus = graphql.field({
  type: resultType,
  args: {
    kind: graphql.arg({ type: graphql.nonNull(graphql.String) }), id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    status: graphql.arg({ type: graphql.nonNull(graphql.String) }), pausedUntil: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) { return setClientBenefitStatusTransaction(context, args); },
});
