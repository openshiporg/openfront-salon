import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { confirmDepositCheckoutTransaction, startDepositCheckoutTransaction } from "../depositCheckout";

const startResult = graphql.object<{ success: boolean; error: string | null; url: string | null }>()({
  name: "StartDepositCheckoutResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    error: graphql.field({ type: graphql.String }),
    url: graphql.field({ type: graphql.String }),
  },
});

const confirmResult = graphql.object<{ success: boolean; error: string | null; paid: boolean; status: string | null }>()({
  name: "ConfirmDepositCheckoutResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    error: graphql.field({ type: graphql.String }),
    paid: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    status: graphql.field({ type: graphql.String }),
  },
});

const args = {
  appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
  accessToken: graphql.arg({ type: graphql.String }),
};

/** Opens a Stripe Checkout for the appointment's deposit. Callers prove access with the booking token or their session. */
export const startDepositCheckout = graphql.field({
  type: startResult,
  args,
  resolve: (_source, input, context: Context) => startDepositCheckoutTransaction(context, input),
});

/** Reads the Checkout back from the provider and settles the deposit (return page and polling). */
export const confirmDepositCheckout = graphql.field({
  type: confirmResult,
  args,
  resolve: (_source, input, context: Context) => confirmDepositCheckoutTransaction(context, input),
});
