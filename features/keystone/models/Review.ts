import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  timestamp,
  checkbox,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Review = list({
  access: {
    operation: {
      query: () => true, // Allow public review viewing
      create: () => true, // Allow public review submission
      update: isSignedIn,
      delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["client", "rating", "service", "stylist", "isApproved", "createdAt"],
    },
  },
  fields: {
    // Rating (1-5 stars)
    rating: integer({
      validation: {
        isRequired: true,
        min: 1,
        max: 5,
      },
      ui: {
        description: "Rating from 1 to 5 stars",
      },
    }),

    // Review content
    comment: text({
      ui: {
        displayMode: "textarea",
        description: "Review comment from the client",
      },
    }),

    // Moderation
    isApproved: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether this review has been approved to display publicly",
      },
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the review was submitted",
      },
    }),

    // Relationships
    client: relationship({
      ref: "Client.reviews",
      ui: {
        displayMode: "select",
        description: "Client who wrote this review",
      },
    }),

    service: relationship({
      ref: "Service.reviews",
      ui: {
        displayMode: "select",
        description: "Service being reviewed",
      },
    }),

    stylist: relationship({
      ref: "Stylist.reviews",
      ui: {
        displayMode: "select",
        description: "Stylist being reviewed",
      },
    }),

    appointment: relationship({
      ref: "Appointment.review",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional)",
      },
    }),
  },
});
