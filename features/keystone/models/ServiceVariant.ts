import { list, graphql } from "@keystone-6/core";
import {
  text,
  relationship,
  integer,
  virtual,
} from "@keystone-6/core/fields";

import { permissions } from "../access";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount / 100);
};

import { trackingFields } from "./trackingFields";

export const ServiceVariant = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "service", "price", "duration", "displayOrder"],
    },
    labelField: "name",
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Variant name (e.g., Junior Stylist, Senior Stylist, Master Stylist)",
      },
    }),

    service: relationship({
      ref: "Service.variants",
      ui: {
        displayMode: "select",
        description: "The service this variant belongs to",
      },
    }),

    price: integer({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Price in cents (overrides base service price if set)",
      },
    }),

    duration: integer({
      ui: {
        description: "Duration in minutes (overrides base service duration if different)",
      },
    }),

    staffLevel: text({
      ui: {
        description: "Staff level/tier this variant applies to (e.g., junior, senior, master)",
      },
    }),

    displayOrder: integer({
      defaultValue: 0,
      ui: {
        description: "Order in which this variant appears",
      },
    }),

    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const variantId = (item as { id: string }).id;
          const variant = await context.sudo().query.ServiceVariant.findOne({
            where: { id: variantId },
            query: "price",
          });

          if (!variant?.price) return "$0.00";
          return formatCurrency(variant.price);
        },
      }),
    }),
    ...trackingFields,
  },
});
