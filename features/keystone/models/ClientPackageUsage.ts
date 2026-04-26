import { list, graphql } from "@keystone-6/core";
import {
  relationship,
  integer,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

export const ClientPackageUsage = list({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["clientPackage", "service", "quantityUsed", "valueUsed", "usedAt"],
    },
  },
  fields: {
    clientPackage: relationship({
      ref: "ClientPackage.usageHistory",
      ui: {
        displayMode: "select",
        description: "The client package this usage is for",
      },
    }),

    appointment: relationship({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "The appointment where this was used",
      },
    }),

    service: relationship({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "The service that was used",
      },
    }),

    quantityUsed: integer({
      defaultValue: 1,
      validation: { min: 1 },
      ui: {
        description: "Number of units used",
      },
    }),

    valueUsed: integer({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Value used in cents",
      },
    }),

    usedAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the package was used",
      },
    }),

    formattedValueUsed: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const usage = await context.sudo().query.ClientPackageUsage.findOne({
            where: { id: item.id },
            query: "valueUsed",
          });

          if (!usage?.valueUsed) return "$0.00";
          return formatCurrency(usage.valueUsed);
        },
      }),
    }),
  },
});
