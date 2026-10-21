import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { validateCarePhotos } from "../privacy";

import { trackingFields } from "./trackingFields";

export const ColorFormula = list({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      // Preserve the exact formula used for each service. A correction is a
      // new formula record, not a destructive edit of client history.
      update: () => false,
      delete: () => false,
    },
  },
  hooks: { validateInput: validateCarePhotos },
  ui: {
    listView: {
      initialColumns: ["formulaName", "client", "stylist", "createdAt"],
    },
  },
  fields: {
    formulaName: text({
      validation: { isRequired: true },
      ui: {
        description: "Name for this formula (e.g., Summer Blonde 2024)",
      },
    }),

    // Products and ratios
    products: text({
      ui: {
        displayMode: "textarea",
        description: "List of products/colors used",
      },
    }),

    measurements: text({
      ui: {
        displayMode: "textarea",
        description: "Exact ratios and measurements (e.g., 30ml A + 15ml B)",
      },
    }),

    processingTime: integer({
      ui: {
        description: "Processing time in minutes",
      },
    }),

    result: text({
      ui: {
        displayMode: "textarea",
        description: "How the color turned out, notes for future reference",
      },
    }),

// Relationships
    client: relationship({
      ref: "Client.colorFormulas",
      ui: {
        displayMode: "select",
      },
    }),

    stylist: relationship({
      ref: "Stylist.colorFormulas",
      ui: {
        displayMode: "select",
      },
    }),

    // Appointment when this formula was applied
    appointment: relationship({
      ref: "Appointment.colorFormula",
      ui: {
        displayMode: "select",
      },
    }),

    // Before/after photo
    photo: relationship({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
      },
    }),
    ...trackingFields,
  },
});
