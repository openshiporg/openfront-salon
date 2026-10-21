import { list, graphql } from "@keystone-6/core";
import {
  select,
  relationship,
  integer,
  float,
  text,
  json,
  virtual,
} from "@keystone-6/core/fields";

import { rules } from "../access";
import { trackingFields } from "./trackingFields";
import { compensationRead } from "../privacy";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

export const SalonTransactionLineItem = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadSalonTransactionLineItems,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["transaction", "itemType", "service", "product", "staff", "formattedTotal"],
    },
  },
  fields: {
    reversalLines: relationship({ ref: "TransactionReversalLine.sourceLine", many: true }),

    transaction: relationship({
      ref: "SalonTransaction.lineItems",
      ui: {
        displayMode: "select",
        description: "Related transaction",
      },
    }),

    itemType: select({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Product", value: "product" },
      ],
      validation: {
        isRequired: true,
      },
    }),

    service: relationship({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service (if itemType is service)",
      },
    }),

    product: relationship({
      ref: "Product",
      ui: {
        displayMode: "select",
        description: "Product (if itemType is product)",
      },
    }),

    staff: relationship({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who provided the service",
      },
    }),

    // Checkout-time snapshot, so receipts don't drift when services or products change.
    title: text({ ui: { itemView: { fieldMode: "read" } } }),
    sku: text({ ui: { itemView: { fieldMode: "read" } } }),
    imagePath: text({ ui: { itemView: { fieldMode: "read" } } }),

    quantity: integer({
      defaultValue: 1,
      validation: {
        isRequired: true,
      },
    }),

    unitPrice: integer({
      validation: {
        isRequired: true,
      },
      ui: {
        description: "Price per unit in cents",
      },
    }),

    discount: integer({
      defaultValue: 0,
      ui: {
        description: "Discount amount in cents",
      },
    }),

    commissionRate: float({
      access: { read: compensationRead },
      ui: {
        description: "Commission rate for staff (percentage)",
      },
    }),

    metadata: json({
      ui: {
        description: "Additional line item metadata",
      },
    }),

    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const lineItemId = (item as { id: string }).id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice",
          });

          if (!lineItem?.unitPrice) return "$0.00";
          return formatCurrency(lineItem.unitPrice);
        },
      }),
    }),

    formattedTotal: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const lineItemId = (item as { id: string }).id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice quantity discount metadata",
          });

          if (!lineItem?.unitPrice || !lineItem?.quantity) return "$0.00";
          const metadata = lineItem.metadata && typeof lineItem.metadata === "object" ? lineItem.metadata as Record<string, unknown> : {};
          const packageCredit = typeof metadata.packageCents === "number" && Number.isSafeInteger(metadata.packageCents) && metadata.packageCents >= 0 ? metadata.packageCents : 0;
          const total = (lineItem.unitPrice * lineItem.quantity) - (lineItem.discount || 0) - packageCredit;
          return formatCurrency(total);
        },
      }),
    }),

    commissionAmount: virtual({
      access: { read: compensationRead },
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const lineItemId = (item as { id: string }).id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice quantity discount commissionRate",
          });

          if (!lineItem?.unitPrice || !lineItem?.quantity || !lineItem?.commissionRate) {
            return "$0.00";
          }

          const total = (lineItem.unitPrice * lineItem.quantity) - (lineItem.discount || 0);
          const commission = total * lineItem.commissionRate;
          return formatCurrency(commission);
        },
      }),
    }),

    ...trackingFields,
  },
});
