import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const ConsultationSubmission = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadConsultationSubmissions },
  },
  fields: {
    client: relationship({ ref: "User.consultationSubmissions" }),
    appointment: relationship({ ref: "Appointment.consultationSubmissions" }),
    templateVersion: relationship({ ref: "ConsultationTemplateVersion.submissions" }),
    answers: json({ defaultValue: {} }),
    questionsHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    answersHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    evidenceHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    signerName: text({ validation: { isRequired: true, length: { max: 200 } } }),
    signerRole: select({
      type: "enum",
      options: [
        { label: "Self", value: "self" },
        { label: "Parent", value: "parent" },
        { label: "Guardian", value: "guardian" },
        { label: "Authorized representative", value: "representative" },
      ],
      validation: { isRequired: true },
    }),
    guardianAuthority: text({ validation: { length: { max: 1000 } } }),
    signatureEvidence: text({ validation: { isRequired: true, length: { max: 5000 } } }),
    actor: relationship({ ref: "User" }),
    actorAuthority: text({ validation: { isRequired: true, length: { max: 120 } } }),
    submittedAt: timestamp({ validation: { isRequired: true } }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveUntil: timestamp(),
    supersedes: relationship({ ref: "ConsultationSubmission.supersededBy" }),
    supersededBy: relationship({ ref: "ConsultationSubmission.supersedes" }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    // Denormalized desk projection; controlled review workflow updates it with each immutable review event.
    reviewStatus: select({
      type: "enum",
      options: [
        { label: "Submitted", value: "submitted" },
        { label: "Reviewed", value: "reviewed" },
        { label: "Needs clarification", value: "needs_clarification" },
        { label: "Accepted for service", value: "accepted_for_service" },
        { label: "Deferred", value: "deferred" },
      ],
      defaultValue: "submitted",
      validation: { isRequired: true },
    }),
    reviews: relationship({ ref: "ConsultationReview.submission", many: true }),
    ...trackingFields,
  },
});
