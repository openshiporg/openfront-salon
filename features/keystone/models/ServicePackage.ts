import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  float,
  integer,
  checkbox,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const ServicePackage = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "totalPrice", "savingsAmount", "isActive"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Package name (e.g., Bridal Package, Spa Day Package)",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
        description: "Detailed description of what's included in the package",
      },
    }),

    totalPrice: float({
      validation: { isRequired: true },
      ui: {
        description: "Total package price",
      },
    }),

    savingsAmount: float({
      defaultValue: 0,
      ui: {
        description: "Amount saved compared to booking services individually",
      },
    }),

    validDays: integer({
      defaultValue: 30,
      ui: {
        description: "Number of days the package is valid after purchase",
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this package is currently available for purchase",
      },
    }),

    // Relationships
    services: relationship({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included in this package",
      },
    }),
  },
});
