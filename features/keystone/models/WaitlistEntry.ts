import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  relationship,
  json,
  checkbox,
  timestamp,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const WaitlistEntry = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["client", "service", "isActive", "dateRangeStart", "dateRangeEnd"],
    },
  },
  fields: {
    // Client requesting the appointment
    client: relationship({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Client waiting for an appointment",
      },
    }),

    // Service they want to book
    service: relationship({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service the client wants to book",
      },
    }),

    // Preferred stylists (many-to-many)
    preferredStylists: relationship({
      ref: "Stylist.waitlistEntries",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["user", "tier"],
        description: "Stylists the client would prefer",
      },
    }),

    // Preferred days of the week
    preferredDays: json({
      ui: {
        description: "Preferred days of week as JSON array, e.g., [\"monday\", \"wednesday\", \"friday\"]",
      },
    }),

    // Preferred time range
    preferredTimeRange: text({
      ui: {
        description: "Preferred time range, e.g., \"9:00-12:00\" or \"morning\" or \"afternoon\"",
      },
    }),

    // Date range the client is available
    dateRangeStart: timestamp({
      ui: {
        description: "Start of date range the client is available",
      },
    }),

    dateRangeEnd: timestamp({
      ui: {
        description: "End of date range the client is available",
      },
    }),

    // Status
    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this waitlist entry is still active",
      },
    }),

    // When the client was notified of availability
    notifiedAt: timestamp({
      ui: {
        description: "When the client was notified that a slot became available",
      },
    }),

    // Notes
    notes: text({
      ui: {
        displayMode: "textarea",
        description: "Additional notes or special requests",
      },
    }),

    // Timestamps
    createdAt: timestamp({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
  },
});
