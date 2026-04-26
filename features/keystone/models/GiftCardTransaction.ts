import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  select,
  float,
  timestamp,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const GiftCardTransaction = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["giftCard", "amount", "type", "createdAt"],
    },
  },
  fields: {
    // Transaction amount
    amount: float({
      validation: { isRequired: true },
      ui: {
        description: "Transaction amount (positive for purchase/refund, negative for redemption)",
      },
    }),

    // Transaction type
    type: select({
      type: "string",
      options: [
        { label: "Purchase", value: "purchase" },
        { label: "Redemption", value: "redemption" },
        { label: "Refund", value: "refund" },
      ],
      validation: { isRequired: true },
      ui: {
        description: "Type of transaction",
      },
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the transaction occurred",
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about this transaction",
      },
    }),

    // Relationships
    giftCard: relationship({
      ref: "GiftCard.transactions",
      ui: {
        displayMode: "select",
        description: "Gift card this transaction belongs to",
      },
    }),

    // Optional appointment (for redemptions)
    appointment: relationship({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Appointment this redemption was applied to (if applicable)",
      },
    }),
  },
});
