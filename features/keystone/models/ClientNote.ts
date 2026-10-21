import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  relationship,
  checkbox,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { validateCarePhotos } from "../privacy";

import { trackingFields } from "./trackingFields";

export const ClientNote = list({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      // Client-care notes are historical evidence; append corrections instead
      // of erasing or silently rewriting prior observations.
      update: () => false,
      delete: () => false,
    },
  },
  hooks: { validateInput: validateCarePhotos },
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
      access: { create: permissions.canManageCareRecords, update: () => false },
      hooks: { resolveInput: ({ operation, context }) => {
        if (operation !== "create") return undefined;
        if (!context.session?.itemId) throw new Error("Care note author must be the authenticated actor");
        return { connect: { id: context.session.itemId } };
      } },
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

    ...trackingFields,
  },
});
