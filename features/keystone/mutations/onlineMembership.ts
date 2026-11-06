import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { startMembershipCheckoutTransaction, settleOnlineMembership, recordMembershipRenewal, syncMembershipBilling, tokenOk, type StartResult, type StatusResult } from "../onlineMembershipService";

export { startMembershipCheckoutTransaction, settleOnlineMembership, recordMembershipRenewal, syncMembershipBilling };

export const startMembershipCheckout = graphql.field({
  type: graphql.object<StartResult>()({
    name: "StartMembershipCheckoutResult",
    fields: { success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), error: graphql.field({ type: graphql.String }), url: graphql.field({ type: graphql.String }) },
  }),
  args: { membershipId: graphql.arg({ type: graphql.nonNull(graphql.ID) }) },
  resolve: (_source, args, context: Context) => startMembershipCheckoutTransaction(context, args),
});

export const confirmMembershipSignup = graphql.field({
  type: graphql.object<StatusResult>()({
    name: "MembershipSignupResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), error: graphql.field({ type: graphql.String }), status: graphql.field({ type: graphql.String }),
      planName: graphql.field({ type: graphql.String }), amount: graphql.field({ type: graphql.Int }), nextBillingDate: graphql.field({ type: graphql.String }),
    },
  }),
  args: { sessionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), token: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  async resolve(_source, args, context: Context) {
    const none = { status: null, planName: null, amount: null, nextBillingDate: null };
    if (!tokenOk(args.sessionId, args.token)) return { success: false, error: "We could not find that sign-up.", ...none };
    try { return await settleOnlineMembership(context, args.sessionId); }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : "We could not check the payment yet.", ...none }; }
  },
});
