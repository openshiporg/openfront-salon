import { list } from "@keystone-6/core";
import {
  text,
  relationship,
  checkbox,
  json,
  select,
} from "@keystone-6/core/fields";

import { permissions } from "../access";

import { trackingFields } from "./trackingFields";
import { workflowOwned } from "../privacy";

export const FormTemplate = list({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      update: permissions.canManageCareRecords,
      delete: () => false,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive", "requiredForCategories"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Form name (e.g., New Client Intake, Color Service Consent)",
      },
    }),

    type: select({
      type: "string",
      options: [
        { label: "Intake", value: "intake" },
        { label: "Consent", value: "consent" },
        { label: "Medical", value: "medical" },
        { label: "Waiver", value: "waiver" },
      ],
      defaultValue: "intake",
      ui: {
        displayMode: "select",
        description: "Type of form",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
        description: "Description of the form's purpose",
      },
    }),

    fields: json({
      ui: {
        description: `JSON array of field definitions: [{id, type (text/textarea/checkbox/radio/select/signature/file), label, required, options (for select/radio), validation}]`,
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this form is currently active",
      },
    }),

    requiredForCategories: relationship({
      ref: "ServiceCategory",
      many: true,
      ui: {
        displayMode: "select",
        description: "Service categories that require this form",
      },
    }),

    versions: relationship({ ref: "ConsultationTemplateVersion.template", many: true, access: workflowOwned }),

    submissions: relationship({
      ref: "FormSubmission.template",
      many: true,
      access: workflowOwned,
      ui: {
        displayMode: "count",
      },
    }),

    metadata: json({
      ui: {
        description: "Additional form metadata",
      },
    }),
    ...trackingFields,
  },
});
