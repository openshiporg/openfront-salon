import { list } from "@keystone-6/core";
import { integer, json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

/** Append-only evidence for initial allocation and every reschedule. */
export const AppointmentScheduleRevision = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadAppointmentScheduleRevisions },
  },
  fields: {
    appointment: relationship({ ref: "Appointment.scheduleRevisions" }),
    revision: integer({ validation: { isRequired: true, min: 1 } }),
    priorStart: timestamp(),
    priorEnd: timestamp(),
    nextStart: timestamp({ validation: { isRequired: true } }),
    nextEnd: timestamp({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    actorAuthority: text({ validation: { isRequired: true, length: { max: 120 } } }),
    scheduleHash: text({ validation: { isRequired: true, length: { max: 128 } } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    segments: relationship({ ref: "AppointmentSegment.revision", many: true }),
    ...trackingFields,
  },
});
