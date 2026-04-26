import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  float,
  timestamp,
  relationship,
  json,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const ProductSale = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["soldAt", "total", "soldBy", "appointment"],
    },
  },
  fields: {
    // Optional link to appointment (for retail sales during service)
    appointment: relationship({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional - for sales during service visits)",
      },
    }),

    // Products sold in this transaction
    products: json({
      defaultValue: [],
      ui: {
        description: "Array of products sold: [{ productId, name, quantity, price, subtotal }]",
      },
    }),

    total: float({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount",
      },
    }),

    // Staff member who made the sale
    soldBy: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the sale",
      },
    }),

    soldAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the sale occurred",
      },
    }),
  },
});
