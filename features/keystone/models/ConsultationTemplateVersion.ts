import { list } from "@keystone-6/core";
import { json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

/** Canonical immutable question/document snapshot. */
export const ConsultationTemplateVersion = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  fields: {
    template: relationship({ ref: "FormTemplate.versions" }),
    version: text({ validation: { isRequired: true, length: { max: 100 } } }),
    titleSnapshot: text({ validation: { isRequired: true, length: { max: 300 } } }),
    purposeSnapshot: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    questions: json({ defaultValue: [] }),
    questionsHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    documentHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveUntil: timestamp(),
    supersedes: relationship({ ref: "ConsultationTemplateVersion.supersededBy" }),
    supersededBy: relationship({ ref: "ConsultationTemplateVersion.supersedes" }),
    submissions: relationship({ ref: "ConsultationSubmission.templateVersion", many: true }),
    ...trackingFields,
  },
});
