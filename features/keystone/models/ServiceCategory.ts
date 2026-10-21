import { list, graphql } from "@keystone-6/core";
import { text, relationship, integer, checkbox, virtual } from "@keystone-6/core/fields";

import { trackingFields } from "./trackingFields";

export const ServiceCategory = list({
  access: {
    operation: {
      query: () => true,
      // Category writes use the validated, auditable salon management workflow.
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["name", "sortOrder", "services"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Category name (e.g., Hair, Nails, Skin, Massage, Makeup)",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
      },
    }),

    slug: text({
      isIndexed: "unique",
      ui: {
        description: "URL-friendly slug (auto-generated from name)",
      },
    }),

    parent: relationship({
      ref: "ServiceCategory",
      ui: {
        displayMode: "select",
        description: "Parent category (for subcategories)",
      },
    }),

    displayOrder: integer({
      defaultValue: 0,
      ui: {
        description: "Sort order for display",
      },
    }),

    // Legacy field
    sortOrder: integer({
      defaultValue: 0,
      ui: {
        description: "Order in which categories appear in the service menu (legacy)",
      },
    }),

    isVisible: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this category is visible on the storefront",
      },
    }),

    icon: text({
      ui: {
        description: "Icon name or emoji for the category",
      },
    }),

    // Relationships
    services: relationship({
      ref: "Service.category",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineCreate: { fields: ["name", "basePrice", "baseDuration"] },
        inlineEdit: { fields: ["name", "basePrice", "baseDuration"] },
      },
    }),

    ...trackingFields,
  },
});
