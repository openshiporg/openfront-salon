import { list, graphql, group } from "@keystone-6/core";
import {
  select,
  relationship,
  integer,
  timestamp,
  json,
  virtual,
} from "@keystone-6/core/fields";

import { rules } from "../access";
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";
import { transactionReceiptTotals } from "../transactionReceipt";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

export const SalonTransaction = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadSalonTransactions,
    },
  },
  hooks: createLifecycleHooks("salon_transaction", ["type", "tip", "paymentMethod", "paymentStatus", "status", "completedAt", "locationId", "clientId", "appointmentId", "staffId"]),
  ui: { hideCreate: true, hideDelete: true,
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

    location: relationship({ ref: "Location" }),

    client: relationship({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client (optional for walk-ins)",
      },
    }),

    appointment: relationship({
      ref: "Appointment.transaction",
      ui: {
        displayMode: "select",
        description: "Appointment being checked out",
      },
    }),

    staff: relationship({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the transaction",
      },
    }),

    reversals: relationship({ ref: "TransactionReversal.transaction", many: true }),

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

    ...group({
      label: "Virtual Fields",
      description: "Calculated fields for transaction totals",
      fields: {
        subtotal: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transactionId = (item as { id: string }).id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata lineItems { quantity unitPrice discount } appointment { payment { tax totalAmount } }",
              });
              const subtotal = transactionReceiptTotals(transaction || {}).subtotal;
              return subtotal === null ? null : formatCurrency(subtotal);
            },
          }),
        }),

        tax: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transactionId = (item as { id: string }).id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata appointment { payment { tax totalAmount } }",
              });
              const tax = transactionReceiptTotals(transaction || {}).tax;
              return tax === null ? null : formatCurrency(tax);
            },
          }),
        }),

        discount: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transactionId = (item as { id: string }).id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata lineItems { quantity unitPrice discount } appointment { payment { tax totalAmount } }",
              });
              const discount = transactionReceiptTotals(transaction || {}).discount;
              return discount === null ? null : formatCurrency(discount);
            },
          }),
        }),

        total: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const transactionId = (item as { id: string }).id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata appointment { payment { tax totalAmount } }",
              });
              const total = transactionReceiptTotals(transaction || {}).total;
              return total === null ? null : formatCurrency(total);
            },
          }),
        }),
      },
    }),

    ...trackingFields,
  },
});
