import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { giftOrderToken, startGiftCardCheckoutTransaction, settleOnlineGiftCard, giftCardOrderTransaction, type StartResult, type StatusResult } from "../onlineGiftCardService";

export { giftOrderToken, startGiftCardCheckoutTransaction, settleOnlineGiftCard, giftCardOrderTransaction };

export const startGiftCardCheckout = graphql.field({
  type: graphql.object<StartResult>()({
    name: "StartGiftCardCheckoutResult",
    fields: { success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), error: graphql.field({ type: graphql.String }), url: graphql.field({ type: graphql.String }) },
  }),
  args: {
    amount: graphql.arg({ type: graphql.nonNull(graphql.Int) }), purchaserName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    purchaserEmail: graphql.arg({ type: graphql.nonNull(graphql.String) }), recipientName: graphql.arg({ type: graphql.String }),
    recipientEmail: graphql.arg({ type: graphql.String }), message: graphql.arg({ type: graphql.String }),
  },
  resolve: (_source, args, context: Context) => startGiftCardCheckoutTransaction(context, args),
});

export const confirmGiftCardOrder = graphql.field({
  type: graphql.object<StatusResult>()({
    name: "GiftCardOrderResult",
    fields: {
      success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), error: graphql.field({ type: graphql.String }), status: graphql.field({ type: graphql.String }),
      code: graphql.field({ type: graphql.String }), amount: graphql.field({ type: graphql.Int }), recipientEmail: graphql.field({ type: graphql.String }),
    },
  }),
  args: { sessionId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), token: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve: (_source, args, context: Context) => giftCardOrderTransaction(context, args),
});
