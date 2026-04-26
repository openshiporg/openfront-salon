import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  relationship,
  integer,
  text,
  json,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const ClientPoints = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  graphql: {
    plural: "ClientPointsRecords",
  },
  ui: {
    listView: {
      initialColumns: ["client", "points", "tier"],
    },
  },
  fields: {
    // Link to User/Client
    client: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "The client who owns these points",
      },
    }),

    // Current points balance
    points: integer({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: {
        description: "Current loyalty points balance",
      },
    }),

    // Loyalty tier based on points
    tier: text({
      defaultValue: "bronze",
      ui: {
        description: "Loyalty tier (e.g., bronze, silver, gold, platinum)",
      },
    }),

    // Transaction history stored as JSON array
    // Each transaction: { date: string, amount: number, reason: string }
    transactions: json({
      defaultValue: [],
      ui: {
        description: "Array of point transactions with date, amount, and reason",
        views: "./features/keystone/fields/json-view",
        createView: { fieldMode: "hidden" },
      },
    }),
  },
});
