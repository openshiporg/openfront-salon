import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { serializableWorkflow } from "./serializableWorkflow";

type CommissionPayoutResult = {
  success: boolean;
  payoutCount: number;
  totalAmount: number;
  error: string | null;
};

const denied = { success: false, payoutCount: 0, totalAmount: 0 };
const COMMISSION_RECOVERY_DELAYS_MS = [0, 50, 150] as const;

function originalCommissionPayoutError(error: unknown) {
  return error instanceof Error ? error.message : "Commission payout failed";
}

function opaqueCommissionLifecycleError(error: unknown) {
  return /Commission\.hooks\.afterOperation: Prisma error/i.test(originalCommissionPayoutError(error));
}

export function completedCommissionPayoutReplay(
  commissions: readonly any[],
  requestedIds: readonly string[],
): CommissionPayoutResult | null {
  const requested = new Set(requestedIds);
  const returnedIds = commissions.map((commission) => commission?.id).filter((id): id is string => typeof id === "string");
  const returned = new Set(returnedIds);
  if (requested.size !== requestedIds.length || commissions.length !== requested.size || returned.size !== commissions.length
    || returnedIds.some((id) => !requested.has(id)) || [...requested].some((id) => !returned.has(id))) return null;

  const stylistIds = new Set(commissions.map((commission) => commission.stylist?.id).filter(Boolean));
  if (stylistIds.size !== 1 || commissions.some((commission) => commission.isPaid !== true || !commission.paidAt
    || Number.isNaN(new Date(commission.paidAt).getTime()) || !Number.isSafeInteger(commission.commissionAmount))) return null;
  const totalAmount = commissions.reduce((sum, commission) => sum + commission.commissionAmount, 0);
  if (!Number.isSafeInteger(totalAmount)) return null;
  return { success: true, payoutCount: 0, totalAmount, error: null };
}

/** Read-only convergence check for an identical payout whose winner may still be committing. */
export async function recoverCompletedCommissionPayout(
  context: Context,
  requestedIds: readonly string[],
  delaysMs: readonly number[] = COMMISSION_RECOVERY_DELAYS_MS,
): Promise<CommissionPayoutResult | null> {
  for (const delayMs of delaysMs.slice(0, COMMISSION_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const commissions = await context.sudo().query.Commission.findMany({
        where: { id: { in: [...requestedIds] } },
        take: Math.min(requestedIds.length + 1, 201),
        query: "id isPaid paidAt commissionAmount stylist { id }",
      });
      const replay = completedCommissionPayoutReplay(commissions, requestedIds);
      if (replay) return replay;
      const returnedIds = new Set(commissions.map((commission: any) => commission.id));
      const exactRows = commissions.length === requestedIds.length && returnedIds.size === requestedIds.length
        && requestedIds.every((id) => returnedIds.has(id));
      if (!exactRows || commissions.some((commission: any) => !commission.stylist?.id)
        || new Set(commissions.map((commission: any) => commission.stylist.id)).size !== 1) return null;
    } catch {
      return null;
    }
  }
  return null;
}

export function classifiedCommissionPayoutError(error: unknown, recovered: CommissionPayoutResult | null) {
  return opaqueCommissionLifecycleError(error) && recovered ? recovered : { ...denied, error: originalCommissionPayoutError(error) };
}

function payoutReference(value?: string | null) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export async function payoutCommissionsTransaction(
  context: Context,
  commissionIds: readonly string[],
  reference?: string | null,
): Promise<CommissionPayoutResult> {
  if (!permissions.canManageCommissions({ session: context.session as any })) {
    return { ...denied, error: "You must be an authorized salon operator" };
  }

  const ids = [...new Set(commissionIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > 200) {
    return { ...denied, error: "Choose between 1 and 200 commissions" };
  }

  try {
    return await serializableWorkflow(
      context,
      "salon-commission-payout",
      ids.map((id) => `commission:${id}`),
      async (transactionContext) => {
        const sudo = transactionContext.sudo();
        const commissions = await sudo.query.Commission.findMany({
          where: { id: { in: ids } },
          take: 200,
          query: "id isPaid paidAt commissionAmount notes stylist { id }",
        });
        if (commissions.length !== ids.length) throw new Error("One or more commissions were not found");

        const stylistIds = new Set(commissions.map((commission: any) => commission.stylist?.id).filter(Boolean));
        if (stylistIds.size !== 1) throw new Error("A payout batch must belong to one stylist");

        const paidAt = new Date().toISOString();
        const ref = payoutReference(reference);
        let payoutCount = 0;
        for (const commission of commissions) {
          if (commission.isPaid) continue;
          await sudo.query.Commission.updateOne({
            where: { id: commission.id },
            data: { isPaid: true, paidAt, ...(ref ? { notes: [commission.notes, `Payout reference: ${ref}`].filter(Boolean).join("\n") } : {}) },
            query: "id",
          });
          payoutCount += 1;
        }

        return {
          success: true,
          payoutCount,
          totalAmount: commissions.reduce((sum: number, commission: any) => sum + Number(commission.commissionAmount || 0), 0),
          error: null,
        };
      },
    );
  } catch (error) {
    const recovered = opaqueCommissionLifecycleError(error)
      ? await recoverCompletedCommissionPayout(context, ids)
      : null;
    return classifiedCommissionPayoutError(error, recovered);
  }
}

const resultType = graphql.object<CommissionPayoutResult>()({
  name: "CommissionPayoutResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    payoutCount: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    totalAmount: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const payoutCommissions = graphql.field({
  type: resultType,
  args: {
    commissionIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) }),
    reference: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) {
    return payoutCommissionsTransaction(context, args.commissionIds, args.reference);
  },
});

/** Marks a stylist's payable card-tip allocations as paid out with wages. */
export async function payoutGratuitiesTransaction(context: Context, stylistId: string, reference?: string | null): Promise<CommissionPayoutResult> {
  if (!permissions.canManageCommissions({ session: context.session as any })) {
    return { ...denied, error: "You must be an authorized salon operator" };
  }
  const id = stylistId.trim();
  if (!id) return { ...denied, error: "Choose a stylist" };
  try {
    return await serializableWorkflow(context, "salon-gratuity-payout", [`gratuity-payout:${id}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const entries = await sudo.query.GratuityLedgerEntry.findMany({
        where: { practitioner: { id: { equals: id } }, type: { equals: "allocation" }, payoutStatus: { equals: "payable" } },
        take: 500,
        query: "id amountDelta evidence",
      });
      const ref = payoutReference(reference);
      const paidAt = new Date().toISOString();
      for (const entry of entries) {
        const evidence = entry.evidence && typeof entry.evidence === "object" ? entry.evidence : {};
        await sudo.query.GratuityLedgerEntry.updateOne({
          where: { id: entry.id },
          data: { payoutStatus: "paid", evidence: { ...evidence, paidOutAt: paidAt, ...(ref ? { payoutReference: ref } : {}) } },
          query: "id",
        });
      }
      return { success: true, payoutCount: entries.length, totalAmount: entries.reduce((sum: number, entry: any) => sum + Number(entry.amountDelta || 0), 0), error: null };
    });
  } catch (error) {
    return { ...denied, error: originalCommissionPayoutError(error) };
  }
}

export const payoutGratuities = graphql.field({
  type: resultType,
  args: {
    stylistId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    reference: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) {
    return payoutGratuitiesTransaction(context, args.stylistId, args.reference);
  },
});
