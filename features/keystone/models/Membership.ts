import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  checkbox,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const Membership = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog,
    },
    filter: {
      query: ({ session }) => (permissions.canManageCatalog({ session }) ? true : { isActive: { equals: true } }),
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "monthlyPrice", "discountPercent", "isActive"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Membership tier name (e.g., Bronze, Silver, Gold, Platinum)",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
        description: "Description of membership benefits and perks",
      },
    }),

    monthlyPrice: integer({
      validation: { isRequired: true },
      ui: {
        description: "Monthly membership fee",
      },
    }),

    discountPercent: integer({
      defaultValue: 0,
      validation: { min: 0, max: 100 },
      ui: {
        description: "Percentage discount on services (0-100)",
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this membership is currently available",
      },
    }),

    // Relationships
    includedServices: relationship({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included for free or at a discount with this membership",
      },
    }),

    ...trackingFields,
  },
});
