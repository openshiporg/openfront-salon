import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  select,
  checkbox,
  timestamp,
  integer,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const StylistSchedule = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["stylist", "dayOfWeek", "startTime", "endTime", "isAvailable"],
    },
  },
  fields: {
    type: select({
      type: "enum",
      options: [
        { label: "Recurring", value: "recurring" },
        { label: "One-time", value: "one_time" },
        { label: "Time-off", value: "time_off" },
      ],
      defaultValue: "recurring",
      validation: {
        isRequired: true,
      },
    }),

    // Day of week for recurring schedules (0-6, Sunday = 0)
    dayOfWeek: integer({
      validation: {
        min: 0,
        max: 6,
      },
      ui: {
        description: "Day of week (0=Sunday, 1=Monday, etc) for recurring schedules",
      },
    }),

    // Legacy string-based day of week
    dayOfWeekLegacy: select({
      type: "enum",
      options: [
        { label: "Monday", value: "monday" },
        { label: "Tuesday", value: "tuesday" },
        { label: "Wednesday", value: "wednesday" },
        { label: "Thursday", value: "thursday" },
        { label: "Friday", value: "friday" },
        { label: "Saturday", value: "saturday" },
        { label: "Sunday", value: "sunday" },
      ],
    }),

    // Date for one-time or time-off entries
    date: timestamp({
      ui: {
        description: "Specific date for one-time schedule or time-off",
      },
    }),

    startTime: text({
      validation: { isRequired: true },
      ui: {
        description: "Start time in HH:MM format (e.g., 09:00)",
      },
    }),

    endTime: text({
      validation: { isRequired: true },
      ui: {
        description: "End time in HH:MM format (e.g., 17:00)",
      },
    }),

    isAvailable: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether stylist is available on this day (false for time off)",
      },
    }),

    // Break times
    breakStart: text({
      ui: {
        description: "Lunch/break start time in HH:MM format",
      },
    }),

    breakEnd: text({
      ui: {
        description: "Lunch/break end time in HH:MM format",
      },
    }),

    reason: text({
      ui: {
        displayMode: "textarea",
        description: "Reason for time-off or special schedule",
      },
    }),

    // Schedule validity period
    effectiveFrom: timestamp({
      ui: {
        description: "When this schedule starts being effective",
      },
    }),

    effectiveTo: timestamp({
      ui: {
        description: "When this schedule ends (null for ongoing recurring schedules)",
      },
    }),

    // Legacy fields
    effectiveDate: timestamp({
      ui: {
        description: "When this schedule starts being effective (legacy - use effectiveFrom)",
      },
    }),

    endDate: timestamp({
      ui: {
        description: "When this schedule ends (legacy - use effectiveTo)",
      },
    }),

    // Relationship to stylist
    stylist: relationship({
      ref: "Stylist.schedules",
      ui: {
        displayMode: "select",
      },
    }),
  },
});
