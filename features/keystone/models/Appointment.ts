import { list, graphql, group } from "@keystone-6/core";
import {
  text,
  relationship,
  select,
  integer,
  timestamp,
  checkbox,
  json,
  virtual,
} from "@keystone-6/core/fields";

import { permissions, rules } from "../access";
import { operationalRead } from "../privacy";
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";

export const Appointment = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadAppointments,
    },
  },
  hooks: createLifecycleHooks("appointment", ["startTime", "endTime", "duration", "status", "depositAmount", "depositPaid", "locationId", "clientId", "stylistId", "resourceId"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["client", "stylist", "startTime", "status", "duration"],
    },
  },
  fields: {
    startTime: timestamp({
      validation: { isRequired: true },
      ui: {
        description: "Start date and time of the appointment",
      },
    }),

    endTime: timestamp({
      ui: {
        description: "End date and time of the appointment",
      },
    }),

    duration: integer({
      defaultValue: 60,
      ui: {
        description: "Total duration in minutes",
      },
    }),

    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No-show", value: "no_show" },
      ],
      defaultValue: "pending",
      validation: {
        isRequired: true,
      },
    }),

    depositAmount: integer({
      ui: {
        description: "Deposit amount required in cents",
      },
    }),

    depositPaid: checkbox({
      defaultValue: false,
      ui: {
        description: "Whether deposit has been paid",
      },
    }),

    clientPolicy: virtual({ field: graphql.field({ type: graphql.JSON, resolve(item: any) {
      const policy = item.metadata?.clientPolicySnapshot;
      return policy ? Object.fromEntries(["version", "acceptedAt", "effectiveFrom", "effectiveUntil", "revokedAt", "cancellationNoticeMinutes", "rescheduleNoticeMinutes", "cancellationDeadline", "rescheduleDeadline"].map(key => [key, policy[key] ?? null])) : null;
    } }) }),
    metadata: json({
      access: { read: operationalRead },
      ui: {
        description: "Additional metadata for the appointment",
      },
    }),

    // Timestamps
    bookedAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the appointment was booked",
      },
    }),

    confirmedAt: timestamp({
      ui: {
        description: "When the appointment was confirmed",
      },
    }),

    cancelledAt: timestamp({
      ui: {
        description: "When the appointment was cancelled",
      },
    }),

    cancellationReason: text({
      ui: {
        displayMode: "textarea",
        description: "Reason for cancellation",
      },
    }),

    // Notes
    notes: text({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Notes and special requests",
      },
    }),

    clientNotes: text({
      ui: {
        displayMode: "textarea",
        description: "Special requests from client",
      },
    }),

    internalNotes: text({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Internal notes for stylists",
      },
    }),

    // Relationships
    location: relationship({ ref: "Location.appointments" }),

    client: relationship({
      ref: "Client.appointments",
      ui: {
        displayMode: "select",
      },
    }),

    stylist: relationship({
      ref: "Stylist.appointments",
      ui: {
        displayMode: "select",
      },
    }),

    resource: relationship({
      ref: "SalonResource.appointments",
      ui: {
        displayMode: "select",
        description: "Room, chair, station, or equipment reserved for this appointment",
      },
    }),

    // Services booked for this appointment (can book multiple)
    services: relationship({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
      },
    }),

    segments: relationship({ ref: "AppointmentSegment.appointment", many: true }),
    scheduleRevisions: relationship({ ref: "AppointmentScheduleRevision.appointment", many: true }),
    consultationSubmissions: relationship({ ref: "ConsultationSubmission.appointment", many: true }),

    // Line items for detailed service tracking
    lineItems: relationship({
      ref: "AppointmentLineItem.appointment",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["service", "staff", "duration", "formattedPrice"],
      },
    }),

    // Color formula applied during this appointment
    colorFormula: relationship({
      ref: "ColorFormula.appointment",
      ui: {
        displayMode: "select",
      },
    }),

    // Payment for this appointment
    payment: relationship({
      ref: "Payment.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["totalAmount", "status", "paymentMethod"],
      },
    }),

    paymentSessions: relationship({
      ref: "PaymentSession.appointment",
      many: true,
      ui: {
        displayMode: "count",
      },
    }),

    transaction: relationship({
      ref: "SalonTransaction.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["paymentStatus", "status", "paymentMethod"],
        description: "Checkout transaction for this appointment",
      },
    }),

    // Review for this appointment
    inventoryMovements: relationship({ ref: "InventoryMovement.appointment", many: true }),

    review: relationship({
      ref: "Review.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["rating", "comment", "isApproved"],
      },
    }),

    ...group({
      label: "Virtual Fields",
      description: "Calculated fields for appointment display",
      fields: {
        formattedDuration: virtual({
          field: graphql.field({
            type: graphql.String,
            async resolve(item, args, context) {
              const appointmentId = (item as { id: string }).id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
                query: "duration",
              });

              if (!appointment?.duration) return "0 min";

              const hours = Math.floor(appointment.duration / 60);
              const minutes = appointment.duration % 60;

              if (hours === 0) return `${minutes} min`;
              if (minutes === 0) return `${hours} hr`;
              return `${hours} hr ${minutes} min`;
            },
          }),
        }),

        isUpcoming: virtual({
          field: graphql.field({
            type: graphql.Boolean,
            async resolve(item, args, context) {
              const appointmentId = (item as { id: string }).id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
                query: "startTime status",
              });

              if (!appointment?.startTime) return false;
              if (appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "no_show") {
                return false;
              }

              return new Date(appointment.startTime) > new Date();
            },
          }),
        }),

        isPast: virtual({
          field: graphql.field({
            type: graphql.Boolean,
            async resolve(item, args, context) {
              const appointmentId = (item as { id: string }).id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
                query: "startTime",
              });

              if (!appointment?.startTime) return false;
              return new Date(appointment.startTime) < new Date();
            },
          }),
        }),
      },
    }),

    ...trackingFields,
  },
});
