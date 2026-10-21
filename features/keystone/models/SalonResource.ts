import { list, graphql } from "@keystone-6/core";
import {
  text,
  relationship,
  select,
  integer,
  checkbox,
  json,
  virtual,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";

export const SalonResource = list({
  access: {
    operation: {
      query: ({ session }) => permissions.canManageResources({ session }) || permissions.canManageAppointments({ session }),
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  hooks: createLifecycleHooks("salon_resource", ["name", "type", "capacity", "isActive", "revision", "locationId"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["name", "type", "location", "capacity", "isActive"],
    },
    labelField: "name",
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Resource name (e.g., Color Bar 1, Treatment Room A, Shampoo Bowl 2)",
      },
    }),

    type: select({
      type: "enum",
      options: [
        { label: "Chair / Station", value: "station" },
        { label: "Treatment Room", value: "room" },
        { label: "Shampoo Bowl", value: "shampoo_bowl" },
        { label: "Equipment", value: "equipment" },
        { label: "Color Bar", value: "color_bar" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "station",
      validation: { isRequired: true },
      ui: {
        description: "The kind of physical resource required to deliver services",
      },
    }),

    revision: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),

    capacity: integer({
      defaultValue: 1,
      ui: {
        description: "How many simultaneous appointments this resource can support",
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this resource can currently be booked",
      },
    }),

    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Operational notes, setup constraints, or room/equipment details",
      },
    }),

    metadata: json({
      ui: {
        description: "Additional resource metadata such as cleanup buffer, equipment tags, or setup rules",
      },
    }),

    location: relationship({
      ref: "Location.resources",
      ui: {
        displayMode: "select",
      },
    }),

    services: relationship({
      ref: "Service.requiredResources",
      many: true,
      ui: {
        displayMode: "count",
        description: "Services that can use this resource",
      },
    }),

    segmentDefinitions: relationship({ ref: "ServiceSegment.eligibleResources", many: true }),
    appointmentSegments: relationship({ ref: "AppointmentSegment.resource", many: true }),

    appointments: relationship({
      ref: "Appointment.resource",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    activeAppointmentCount: virtual({
      field: graphql.field({
        type: graphql.Int,
        async resolve(item, args, context) {
          const resourceId = (item as { id: string }).id;
          return context.sudo().query.Appointment.count({
            where: {
              resource: { id: { equals: resourceId } },
              status: { in: ["pending", "confirmed", "in_progress"] },
            },
          });
        },
      }),
    }),

    ...trackingFields,
  },
});
