import { list } from "@keystone-6/core";
import { checkbox, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

/** Booked segment allocation snapshot. Only controlled scheduling workflows write it. */
export const AppointmentSegment = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadAppointmentSegments },
  },
  fields: {
    appointment: relationship({ ref: "Appointment.segments" }),
    lineItem: relationship({ ref: "AppointmentLineItem.segments" }),
    definition: relationship({ ref: "ServiceSegment" }),
    revision: relationship({ ref: "AppointmentScheduleRevision.segments" }),
    stableKey: text({ validation: { isRequired: true, length: { max: 120 } } }),
    sequence: integer({ validation: { isRequired: true, min: 0 } }),
    parallelGroup: text({ validation: { length: { max: 120 } } }),
    type: select({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Processing", value: "processing" },
        { label: "Finishing", value: "finishing" },
        { label: "Cleanup", value: "cleanup" },
      ],
      validation: { isRequired: true },
    }),
    plannedStart: timestamp({ validation: { isRequired: true } }),
    plannedEnd: timestamp({ validation: { isRequired: true } }),
    durationMinutes: integer({ validation: { isRequired: true, min: 1 } }),
    practitionerRequired: checkbox({ defaultValue: true }),
    practitioner: relationship({ ref: "Stylist.appointmentSegments" }),
    resource: relationship({ ref: "SalonResource.appointmentSegments" }),
    resourceUnits: integer({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    status: select({
      type: "enum",
      options: [
        { label: "Planned", value: "planned" },
        { label: "Started", value: "started" },
        { label: "Completed", value: "completed" },
        { label: "Skipped", value: "skipped" },
        { label: "Superseded", value: "superseded" },
      ],
      defaultValue: "planned",
      validation: { isRequired: true },
    }),
    assignmentEvidence: json({ defaultValue: {} }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    transitions: relationship({ ref: "SegmentTransition.segment", many: true }),
    ...trackingFields,
  },
});
