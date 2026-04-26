import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  select,
  json,
  checkbox,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const MessageTemplate = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Template name for identification",
      },
    }),

    type: select({
      type: "string",
      options: [
        { label: "Reminder", value: "reminder" },
        { label: "Confirmation", value: "confirmation" },
        { label: "Marketing", value: "marketing" },
      ],
      validation: { isRequired: true },
      ui: {
        description: "Type of message template",
      },
    }),

    content: text({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
        description: "Message content with variables like {{clientName}}, {{appointmentDate}}, {{stylistName}}",
      },
    }),

    variables: json({
      ui: {
        description: "Available variables for this template, e.g., [\"clientName\", \"appointmentDate\", \"stylistName\"]",
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this template is currently active and available for use",
      },
    }),
  },
});
