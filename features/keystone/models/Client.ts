import { list, graphql, group } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  select,
  integer,
  float,
  timestamp,
  checkbox,
  virtual,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Client = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["user", "hairType", "preferredStylist", "totalVisits", "lifetimeValue"],
    },
  },
  fields: {
    // Link to User for contact info
    user: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
      },
    }),

    dateOfBirth: timestamp({
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
      ui: {
        displayMode: "textarea",
        description: "Known allergies (e.g., latex, certain dyes)",
      },
    }),

    skinSensitivities: text({
      ui: {
        displayMode: "textarea",
        description: "Skin sensitivities or conditions",
      },
    }),

    skinType: select({
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

    lifetimeValue: float({
      defaultValue: 0,
      ui: {
        description: "Total revenue from this client",
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
  },
});
