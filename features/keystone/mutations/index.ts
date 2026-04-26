import { graphql } from "@keystone-6/core";
import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import { paymentMutations } from "./processPayment";
import { giftCardMutations } from "./purchaseGiftCard";

const gql = String.raw;

export const extendGraphqlSchema = graphql.extend((base) => ({
  query: {
    redirectToInit: graphql.field({
      type: graphql.Boolean,
      resolve: redirectToInit,
    }),
  },
  mutation: {
    processPayment: paymentMutations.processPayment,
    confirmPayment: paymentMutations.confirmPayment,
    refundPayment: paymentMutations.refundPayment,
    distributeTip: paymentMutations.distributeTip,
    purchaseGiftCard: giftCardMutations.purchaseGiftCard,
    confirmGiftCardPurchase: giftCardMutations.confirmGiftCardPurchase,
  },
}));