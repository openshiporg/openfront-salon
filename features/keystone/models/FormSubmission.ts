import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  timestamp,
  json,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";

import { trackingFields } from "./trackingFields";

export const FormSubmission = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCareRecords,
      // Submitted consultation evidence is append-only. Corrections create a
      // new submission rather than rewriting or deleting what was signed.
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadFormSubmissions,
    },
  },
  ui: {
    listView: {
      initialColumns: ["client", "form", "submittedAt", "appointment"],
    },
  },
  fields: {
    // Form data stored as JSON
    data: json({
      ui: {
        description: "Form field responses as JSON object",
      },
    }),

    // Digital signature
    signature: text({
      ui: {
        displayMode: "textarea",
        description: "Client's digital signature (base64 encoded or signature data)",
      },
    }),

    // Submission timestamp
    submittedAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the form was submitted",
      },
    }),

    // Relationships
    client: relationship({
      ref: "User.formSubmissions",
      ui: {
        displayMode: "select",
        description: "Client who submitted the form",
      },
    }),

    form: relationship({
      ref: "IntakeForm.submissions",
      ui: {
        displayMode: "select",
        description: "The intake form template that was filled out (legacy)",
      },
    }),

    template: relationship({
      ref: "FormTemplate.submissions",
      ui: {
        displayMode: "select",
        description: "The form template that was filled out",
      },
    }),

    // Optional link to appointment
    appointment: relationship({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (if applicable)",
      },
    }),
    ...trackingFields,
  },
});
