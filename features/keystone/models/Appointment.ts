import { list, graphql, group } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
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

import { isSignedIn } from "../access";

export const Appointment = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
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

    metadata: json({
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
      ui: {
        displayMode: "textarea",
        description: "Internal notes for stylists",
      },
    }),

    // Relationships
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

    // Services booked for this appointment (can book multiple)
    services: relationship({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
      },
    }),

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

    // Review for this appointment
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
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
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
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
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
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
                query: "startTime",
              });

              if (!appointment?.startTime) return false;
              return new Date(appointment.startTime) < new Date();
            },
          }),
        }),
      },
    }),
  },
});
