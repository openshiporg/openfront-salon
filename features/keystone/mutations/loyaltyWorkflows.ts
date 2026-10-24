import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { postPoints } from "../loyalty";
import { serializableWorkflow } from "./serializableWorkflow";

type Result = { success: boolean; balance: number | null; error: string | null };
const denied = { success: false, balance: null };

/** Manual points change (redemption at the desk, goodwill, correction) with a required reason. */
export async function adjustClientPointsTransaction(context: Context, args: { userId: string; points: number; reason: string }): Promise<Result> {
  if (!permissions.canManageClients({ session: context.session as any })) return { ...denied, error: "Client authority is required" };
  const reason = args.reason.trim();
  if (!Number.isInteger(args.points) || args.points === 0 || Math.abs(args.points) > 1_000_000) return { ...denied, error: "Enter a whole number of points" };
  if (!reason || reason.length > 500) return { ...denied, error: "Enter a reason" };
  try {
    return await serializableWorkflow(context, "salon-loyalty", [`points:${args.userId}`], async (tx) => {
      const sudo = tx.sudo();
      const user = await sudo.query.User.findOne({ where: { id: args.userId }, query: "id" });
      if (!user) throw new Error("Client account not found");
      const record: any = await postPoints(sudo, user.id, args.points, { reason, source: args.points < 0 ? "redemption" : "adjustment", actorId: context.session!.itemId });
      return { success: true, balance: Number(record?.points || 0), error: null };
    });
  } catch (error) {
    return { ...denied, error: error instanceof Error ? error.message : "Points could not be changed" };
  }
}

/** Marks a referral completed and posts a points reward to the referrer once. */
export async function completeReferralTransaction(context: Context, args: { referralId: string }): Promise<Result> {
  if (!permissions.canManageClients({ session: context.session as any })) return { ...denied, error: "Client authority is required" };
  try {
    return await serializableWorkflow(context, "salon-loyalty", [`referral:${args.referralId}`], async (tx) => {
      const sudo = tx.sudo();
      const referral = await sudo.query.Referral.findOne({ where: { id: args.referralId }, query: "id status rewardAmount rewardType referrer { id }" });
      if (!referral) throw new Error("Referral not found");
      if (referral.status === "completed") return { success: true, balance: null, error: null };
      if (referral.status !== "pending") throw new Error("Only a pending referral can be completed");
      await sudo.query.Referral.updateOne({ where: { id: referral.id }, data: { status: "completed", completedAt: new Date().toISOString() }, query: "id" });
      let balance: number | null = null;
      if (referral.rewardType === "points" && referral.referrer?.id && Number(referral.rewardAmount) > 0) {
        const record: any = await postPoints(sudo, referral.referrer.id, Number(referral.rewardAmount), { reason: "Referral reward", source: "referral", reference: `referral:${referral.id}`, actorId: context.session!.itemId });
        balance = Number(record?.points || 0);
      }
      return { success: true, balance, error: null };
    });
  } catch (error) {
    return { ...denied, error: error instanceof Error ? error.message : "Referral could not be completed" };
  }
}

const resultType = graphql.object<Result>()({
  name: "LoyaltyWorkflowResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    balance: graphql.field({ type: graphql.Int }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const adjustClientPoints = graphql.field({
  type: resultType,
  args: { userId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), points: graphql.arg({ type: graphql.nonNull(graphql.Int) }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve(_source, args, context: Context) { return adjustClientPointsTransaction(context, args); },
});

export const completeReferral = graphql.field({
  type: resultType,
  args: { referralId: graphql.arg({ type: graphql.nonNull(graphql.ID) }) },
  resolve(_source, args, context: Context) { return completeReferralTransaction(context, args); },
});
