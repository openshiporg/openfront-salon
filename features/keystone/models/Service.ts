import { list, graphql, group } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  float,
  checkbox,
  json,
  select,
  virtual,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const Service = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "category", "basePrice", "baseDuration"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Service name (e.g., Haircut, Color, Highlights, Manicure, Facial)",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
      },
    }),

    baseDuration: integer({
      validation: { isRequired: true },
      ui: {
        description: "Duration in minutes",
      },
    }),

    // Price in cents for consistency with other models
    price: integer({
      validation: { isRequired: true },
      ui: {
        description: "Base price in cents",
      },
    }),

    // Keep legacy float field for backwards compatibility
    basePrice: float({
      ui: {
        description: "Base price for the service (legacy - use price field)",
      },
    }),

    depositRequired: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether a deposit is required to book this service",
      },
    }),

    depositAmount: integer({
      ui: {
        description: "Deposit amount required in cents",
      },
    }),

    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
    }),

    metadata: json({
      ui: {
        description: "Additional service metadata",
      },
    }),

    pricingTier: json({
      ui: {
        description: "Pricing by stylist tier, e.g., {junior: 50, senior: 75, master: 100}",
      },
    }),

    requiresConsultation: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a consultation first",
      },
    }),

    requiresPatchTest: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a patch test (e.g., for color services)",
      },
    }),

    // Relationships
    category: relationship({
      ref: "ServiceCategory.services",
      ui: {
        displayMode: "select",
      },
    }),

    // Image relationship (optional - for service photos)
    image: relationship({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
      },
    }),

    // Stylists who specialize in this service
    specialists: relationship({
      ref: "Stylist.specializations",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    reviews: relationship({
      ref: "Review.service",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    variants: relationship({
      ref: "ServiceVariant.service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "price", "duration", "staffLevel"],
        inlineCreate: { fields: ["name", "price", "duration", "staffLevel", "displayOrder"] },
        inlineEdit: { fields: ["name", "price", "duration", "staffLevel", "displayOrder"] },
        description: "Pricing variants by stylist tier",
      },
    }),

    formattedPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item, args, context) {
          const service = await context.sudo().query.Service.findOne({
            where: { id: item.id },
            query: "price",
          });

          if (!service?.price) return "$0.00";
          return formatCurrency(service.price / 100);
        },
      }),
    }),
  },
});
