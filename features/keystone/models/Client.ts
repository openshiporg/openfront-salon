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
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";

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
  hooks: createLifecycleHooks("client", ["userId", "preferredStylistId", "homeLocationId", "totalVisits", "lifetimeValue", "marketingConsent"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["user", "hairType", "preferredStylist", "totalVisits", "lifetimeValue"],
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

    // Visit tracking
    firstVisit: timestamp({
      ui: {
        description: "Date of first visit",
      },
    }),

    lastVisit: timestamp({
      ui: {
        description: "Date of most recent visit",
      },
    }),

    totalVisits: integer({
      defaultValue: 0,
      ui: {
        description: "Total number of visits",
      },
    }),

    lifetimeValue: integer({
      defaultValue: 0,
      validation: { min: 0 },
      ui: {
        description: "Total revenue from this client in cents",
      },
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
