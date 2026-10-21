import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const SegmentTransition = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadSegmentTransitions },
  },
  fields: {
    segment: relationship({ ref: "AppointmentSegment.transitions" }),
    fromStatus: select({ type: "string", options: ["planned", "started", "completed", "skipped", "superseded"].map(value => ({ label: value, value })) }),
    toStatus: select({ type: "string", options: ["planned", "started", "completed", "skipped", "superseded"].map(value => ({ label: value, value })), validation: { isRequired: true } }),
    reason: text({ validation: { length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
