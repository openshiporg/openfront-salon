import { list, graphql, group } from "@keystone-6/core";
import {
  text,
  relationship,
  select,
  integer,
  timestamp,
  checkbox,
  virtual,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { ownCareRead } from "../privacy";
import { trackingFields } from "./trackingFields";

/** Visit stats are recomputed by the server (sudo); people and API callers cannot write them. */
const derived = { create: () => false, update: () => false };

export const Client = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadClients,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["user", "hairType", "preferredStylist", "totalVisits", "lifetimeSpend"],
    },
  },
  fields: {
    // Link to User for contact info
    user: relationship({
      ref: "User.clientProfile",
      ui: {
        displayMode: "select",
      },
    }),

    // Contact details for a client without a sign-in account (web guests, desk records).
    // Never used as account identity.
    guestName: text({ ui: { description: "Contact name when the client has no account" } }),
    guestEmail: text({ isIndexed: true, ui: { description: "Contact email when the client has no account" } }),
    guestPhone: text({ ui: { description: "Contact phone when the client has no account" } }),
    displayName: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context) {
          if (item.userId) {
            const user = await context.sudo().query.User.findOne({ where: { id: item.userId }, query: "name" });
            if (user?.name) return user.name;
          }
          return item.guestName || null;
        },
      }),
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" }, createView: { fieldMode: "hidden" } },
    }),

    homeLocation: relationship({ ref: "Location.clients" }),

    dateOfBirth: timestamp({
      access: { read: ownCareRead },
      ui: {
        description: "Client's date of birth",
      },
    }),

    // Preferred stylist
    preferredStylist: relationship({
      ref: "Stylist.preferredByClients",
      ui: {
        displayMode: "select",
      },
    }),

    // Health and sensitivity information
    allergies: text({
      access: { read: ownCareRead },
      ui: {
        displayMode: "textarea",
        description: "Known allergies (e.g., latex, certain dyes)",
      },
    }),

    skinSensitivities: text({
      access: { read: ownCareRead },
      ui: {
        displayMode: "textarea",
        description: "Skin sensitivities or conditions",
      },
    }),

    skinType: select({
      access: { read: ownCareRead },
      type: "enum",
      options: [
        { label: "Oily", value: "oily" },
        { label: "Dry", value: "dry" },
        { label: "Combination", value: "combination" },
        { label: "Sensitive", value: "sensitive" },
      ],
      ui: {
        description: "Skin type",
      },
    }),

    // Hair profile
    hairType: select({
      type: "enum",
      options: [
        { label: "Straight", value: "straight" },
        { label: "Wavy", value: "wavy" },
        { label: "Curly", value: "curly" },
        { label: "Coily", value: "coily" },
      ],
      ui: {
        description: "Natural hair pattern",
      },
    }),

    hairTexture: select({
      type: "string",
      options: [
        { label: "Fine", value: "fine" },
        { label: "Medium", value: "medium" },
        { label: "Coarse", value: "coarse" },
      ],
      ui: {
        description: "Hair thickness/texture",
      },
    }),

    scalpCondition: select({
      access: { read: ownCareRead },
      type: "string",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Dry", value: "dry" },
        { label: "Oily", value: "oily" },
        { label: "Sensitive", value: "sensitive" },
      ],
      ui: {
        description: "Scalp condition",
      },
    }),

    // Internal notes
    notes: text({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Internal notes about client preferences and history",
      },
    }),

    // Visit tracking: derived from completed appointments and sales by
    // features/keystone/clientStats.ts. Stored for sorting; never edited by hand.
    firstVisit: timestamp({
      access: derived,
      ui: { description: "Start of the first completed appointment", createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),

    lastVisit: timestamp({
      access: derived,
      ui: { description: "Start of the most recent completed appointment", createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),

    totalVisits: integer({
      defaultValue: 0,
      access: derived,
      ui: { description: "Completed appointments", createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),

    lifetimeValue: integer({
      defaultValue: 0,
      validation: { min: 0 },
      access: derived,
      ui: { description: "Pre-tax spend on completed sales, less refunds, in cents", createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } },
    }),

    // The list column: lifetimeValue as dollars, so the table never shows raw cents.
    lifetimeSpend: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve: (item) => `$${(Number((item as { lifetimeValue?: number | null }).lifetimeValue || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      }),
      label: "Lifetime Value",
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "read" } },
    }),

    // Consent
    photoConsent: checkbox({
      defaultValue: false,
      ui: {
        description: "Consent to use photos for marketing",
      },
    }),

    marketingConsent: checkbox({
      defaultValue: false,
      ui: {
        description: "Consent to receive marketing communications",
      },
    }),

    // Relationships
    appointments: relationship({
      ref: "Appointment.client",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    colorFormulas: relationship({
      ref: "ColorFormula.client",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["formulaName", "createdAt"],
      },
    }),

    reviews: relationship({
      ref: "Review.client",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    ...trackingFields,
  },
});
