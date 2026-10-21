import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

/** Effective-dated, append-only service timing definition. Revisions supersede records. */
export const ServiceSegment = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: () => false,
      delete: () => false,
    },
  },
  fields: {
    service: relationship({ ref: "Service.segmentDefinitions" }),
    stableKey: text({ validation: { isRequired: true, length: { max: 120 } } }),
    version: integer({ validation: { isRequired: true, min: 1 } }),
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
    durationMinutes: integer({ validation: { isRequired: true, min: 1 } }),
    practitionerRequired: checkbox({ defaultValue: true }),
    qualifiedPractitioners: relationship({ ref: "Stylist.segmentQualifications", many: true }),
    eligibleResources: relationship({ ref: "SalonResource.segmentDefinitions", many: true }),
    resourceUnits: integer({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    effectiveFrom: timestamp({ validation: { isRequired: true } }),
    effectiveUntil: timestamp(),
    supersedes: relationship({ ref: "ServiceSegment.supersededBy" }),
    supersededBy: relationship({ ref: "ServiceSegment.supersedes" }),
    ...trackingFields,
  },
});
