import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { readLocationStock } from "../inventory/locationStockRead";

export const salonLocationStock = graphql.field({
  type: graphql.JSON,
  args: {
    appointmentId: graphql.arg({ type: graphql.ID }), locationId: graphql.arg({ type: graphql.ID }),
    skip: graphql.arg({ type: graphql.Int }), take: graphql.arg({ type: graphql.Int }), search: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) { return readLocationStock(context, args); },
});
