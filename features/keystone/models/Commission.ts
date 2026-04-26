import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  relationship,
  float,
  timestamp,
  checkbox,
  text,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Commission = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["stylist", "payment", "saleAmount", "commissionRate", "commissionAmount", "isPaid"],
    },
  },
  fields: {
    // Commission calculation fields
    saleAmount: float({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount for this service",
      },
    }),

    commissionRate: float({
      validation: { isRequired: true, min: 0, max: 1 },
      ui: {
        description: "Commission rate applied (e.g., 0.5 for 50%)",
      },
    }),

    commissionAmount: float({
      validation: { isRequired: true },
      ui: {
        description: "Calculated commission amount (saleAmount * commissionRate)",
      },
    }),

    // Payment status
    isPaid: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether this commission has been paid to the stylist",
      },
    }),

    paidAt: timestamp({
      ui: {
        description: "When the commission was paid to the stylist",
      },
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the commission was recorded",
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Notes about this commission",
      },
    }),

    // Relationships
    stylist: relationship({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Stylist who earned this commission",
      },
    }),

    service: relationship({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service that generated this commission",
      },
    }),

    payment: relationship({
      ref: "Payment",
      ui: {
        displayMode: "select",
        description: "Payment associated with this commission",
      },
    }),
  },
});
