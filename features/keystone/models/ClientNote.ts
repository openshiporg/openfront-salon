import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  relationship,
  checkbox,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const ClientNote = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["client", "author", "isPrivate", "createdAt"],
    },
  },
  fields: {
    client: relationship({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client this note is about",
      },
    }),

    author: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who wrote this note",
      },
    }),

    content: text({
      ui: {
        displayMode: "textarea",
        description: "Note content",
      },
      validation: {
        isRequired: true,
      },
    }),

    isPrivate: checkbox({
      defaultValue: true,
      ui: {
        description: "Visible only to staff (not shown to client)",
      },
    }),

    appointment: relationship({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Related appointment (if any)",
      },
    }),

    photos: relationship({
      ref: "SalonImage",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        description: "Before/after photos",
      },
    }),

    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),

    updatedAt: timestamp({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
