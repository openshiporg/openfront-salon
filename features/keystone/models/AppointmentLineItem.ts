import { list, graphql } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  integer,
  relationship,
  text,
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

export const AppointmentLineItem = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["service", "staff", "duration", "price", "appointment"],
    },
  },
  fields: {
    service: relationship({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service being provided",
      },
    }),

    staff: relationship({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member providing this service",
      },
    }),

    duration: integer({
      defaultValue: 60,
      ui: {
        description: "Duration of this service in minutes",
      },
    }),

    price: integer({
      validation: { isRequired: true },
      ui: {
        description: "Price in cents",
      },
    }),

    quantity: integer({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: {
        description: "Quantity of this service (usually 1)",
      },
    }),

    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Special requests or notes for this service",
      },
    }),

    appointment: relationship({
      ref: "Appointment.lineItems",
      ui: {
        displayMode: "select",
        description: "Related appointment",
      },
    }),

    metadata: json({
      ui: {
        description: "Additional metadata for the line item",
      },
    }),

    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: item.id },
            query: "price",
          });

          if (!lineItem?.price) return "$0.00";
          return formatCurrency(lineItem.price);
        },
      }),
    }),

    formattedTotal: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: item.id },
            query: "price quantity",
          });

          if (!lineItem?.price || !lineItem?.quantity) return "$0.00";
          const total = lineItem.price * lineItem.quantity;
          return formatCurrency(total);
        },
      }),
    }),
  },
});
