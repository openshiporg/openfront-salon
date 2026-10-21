import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const ConsultationReview = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadConsultationReviews },
  },
  fields: {
    submission: relationship({ ref: "ConsultationSubmission.reviews" }),
    status: select({
      type: "enum",
      options: ["reviewed", "needs_clarification", "accepted_for_service", "deferred"].map(value => ({ label: value, value })),
      validation: { isRequired: true },
    }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    actorAuthority: text({ validation: { isRequired: true, length: { max: 120 } } }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
