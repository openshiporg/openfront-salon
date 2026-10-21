import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  integer,
  timestamp,
  checkbox,
  virtual,
} from "@keystone-6/core/fields";
import { graphql } from "@keystone-6/core";

import { permissions } from "../access";

import { trackingFields } from "./trackingFields";

export const Review = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients,
    },
    filter: {
      query: ({ session }) => (permissions.canManageClients({ session }) ? true : { isApproved: { equals: true } }),
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
    // Public display names for approved reviews: first name plus last initial.
    reviewerName: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context) {
          if (!item.clientId) return null;
          const client = await context.sudo().query.Client.findOne({ where: { id: item.clientId }, query: "user { name }" });
          return publicName(client?.user?.name);
        },
      }),
    }),
    stylistName: virtual({
      field: graphql.field({
        type: graphql.String,
        async resolve(item: any, _args, context) {
          if (!item.stylistId) return null;
          const stylist = await context.sudo().query.Stylist.findOne({ where: { id: item.stylistId }, query: "user { name }" });
          return typeof stylist?.user?.name === "string" ? stylist.user.name.trim() || null : null;
        },
      }),
    }),
    ...trackingFields,
  },
});

function publicName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
