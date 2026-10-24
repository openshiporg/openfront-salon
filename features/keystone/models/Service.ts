import { list, graphql, group } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  checkbox,
  json,
  select,
  virtual,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";
import { workflowOwned } from "../privacy";

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const Service = list({
  access: {
    operation: {
      query: () => true,
      // Keep core service writes on the validated, auditable catalog workflow.
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => session ? true : { AND: [
        { status: { equals: "active" } },
        { requiresConsultation: { equals: false } },
        { requiresPatchTest: { equals: false } },
      ] },
    },
  },
  ui: { hideCreate: true, hideDelete: true,
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

    // Turnover after this service before the stylist's next booking (none after a blowout, more after colour).
    bufferMinutes: integer({
      defaultValue: 15,
      validation: { min: 0, max: 120 },
      ui: {
        description: "Minutes kept free after this service before the next booking",
      },
    }),

    // Price in cents for consistency with other models
    price: integer({
      validation: { isRequired: true },
      ui: {
        description: "Base price in cents",
      },
    }),

    // Deprecated alias retained for API compatibility; values are cents.
    basePrice: integer({
      ui: {
        description: "Base price in cents (deprecated; use price)",
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
        cardFields: ["image", "imagePath", "altText"],
        inlineCreate: { fields: ["imagePath", "altText"] },
        inlineEdit: { fields: ["imagePath", "altText"] },
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

    requiredResources: relationship({
      ref: "SalonResource.services",
      many: true,
      ui: {
        displayMode: "count",
        description: "Rooms, chairs, stations, or equipment required to deliver this service",
      },
    }),

    reviews: relationship({
      ref: "Review.service",
      many: true,
      access: workflowOwned,
      ui: {
        displayMode: "count",
      },
    }),

    segmentDefinitions: relationship({
      ref: "ServiceSegment.service",
      many: true,
      access: workflowOwned,
      ui: { displayMode: "count", description: "Effective-dated, append-only service timing segments" },
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
          const serviceId = (item as { id: string }).id;
          const service = await context.sudo().query.Service.findOne({
            where: { id: serviceId },
            query: "price",
          });

          if (!service?.price) return "$0.00";
          return formatCurrency(service.price / 100);
        },
      }),
    }),

    ...trackingFields,
  },
});
