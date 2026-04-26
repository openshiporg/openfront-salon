import { list, graphql, group } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  select,
  relationship,
  integer,
  timestamp,
  json,
  virtual,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

export const SalonTransaction = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["type", "client", "staff", "total", "paymentStatus", "status"],
    },
  },
  fields: {
    type: select({
      type: "enum",
      options: [
        { label: "Appointment", value: "appointment" },
        { label: "Walk-in", value: "walk_in" },
        { label: "Retail", value: "retail" },
      ],
      defaultValue: "appointment",
      validation: {
        isRequired: true,
      },
    }),

    client: relationship({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client (optional for walk-ins)",
      },
    }),

    staff: relationship({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the transaction",
      },
    }),

    lineItems: relationship({
      ref: "SalonTransactionLineItem.transaction",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["itemType", "service", "product", "formattedTotal"],
      },
    }),

    tip: integer({
      defaultValue: 0,
      ui: {
        description: "Tip amount in cents",
      },
    }),

    paymentMethod: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Card", value: "card" },
        { label: "Split", value: "split" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Package", value: "package" },
      ],
      ui: {
        description: "Payment method used",
      },
    }),

    paymentStatus: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Paid", value: "paid" },
        { label: "Partially Paid", value: "partially_paid" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "pending",
      validation: {
        isRequired: true,
      },
    }),

    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Completed", value: "completed" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "open",
      validation: {
        isRequired: true,
      },
    }),

    metadata: json({
      ui: {
        description: "Additional transaction metadata",
      },
    }),

    completedAt: timestamp({
      ui: {
        description: "When the transaction was completed",
      },
    }),

    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),

    ...group({
      label: "Virtual Fields",
      description: "Calculated fields for transaction totals",
      fields: {
        subtotal: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                `,
              });

              if (!transaction?.lineItems?.length) return "$0.00";

              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = (lineItem.unitPrice * lineItem.quantity) - (lineItem.discount || 0);
                subtotal += lineTotal;
              }

              return formatCurrency(subtotal);
            },
          }),
        }),

        tax: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                `,
              });

              if (!transaction?.lineItems?.length) return "$0.00";

              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = (lineItem.unitPrice * lineItem.quantity) - (lineItem.discount || 0);
                subtotal += lineTotal;
              }

              // Assume 8% tax rate (should be configurable)
              const tax = subtotal * 0.08;
              return formatCurrency(tax);
            },
          }),
        }),

        discount: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    discount
                  }
                `,
              });

              if (!transaction?.lineItems?.length) return "$0.00";

              const totalDiscount = transaction.lineItems.reduce(
                (sum, item) => sum + (item.discount || 0),
                0
              );

              if (totalDiscount === 0) return "$0.00";
              return formatCurrency(totalDiscount);
            },
          }),
        }),

        total: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                  tip
                `,
              });

              if (!transaction?.lineItems?.length) return "$0.00";

              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = (lineItem.unitPrice * lineItem.quantity) - (lineItem.discount || 0);
                subtotal += lineTotal;
              }

              const tax = subtotal * 0.08;
              const total = subtotal + tax + (transaction.tip || 0);

              return formatCurrency(total);
            },
          }),
        }),
      },
    }),
  },
});
