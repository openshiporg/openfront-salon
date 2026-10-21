import { list } from "@keystone-6/core";
import {
  relationship,
  select,
  timestamp,
} from "@keystone-6/core/fields";

import { rules } from "../access";
import { createLifecycleHooks } from "../lifecycle";

import { trackingFields } from "./trackingFields";

export const ClientMembership = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: rules.canReadClientMemberships,
    },
  },
  hooks: createLifecycleHooks("client_membership", ["status", "startDate", "nextBillingDate", "pausedUntil", "clientId", "membershipId"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["client", "membership", "status", "startDate", "nextBillingDate"],
    },
  },
  fields: {
    // Link to User (client)
    client: relationship({
      ref: "User.clientMemberships",
      ui: {
        displayMode: "select",
        description: "The client who holds this membership",
      },
    }),

    // Link to Membership plan
    membership: relationship({
      ref: "Membership",
      ui: {
        displayMode: "select",
        description: "The membership plan",
      },
    }),

    // Membership dates
    startDate: timestamp({
      validation: { isRequired: true },
      ui: {
        description: "When the membership started",
      },
    }),

    nextBillingDate: timestamp({
      ui: {
        description: "Next billing date for recurring memberships",
      },
    }),

    // Membership status
    status: select({
      type: "string",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Cancelled", value: "cancelled" },
      ],
      ui: {
        displayMode: "segmented-control",
        description: "Current status of the membership",
      },
    }),

    // Pause management
    pausedUntil: timestamp({
      ui: {
        description: "If paused, when the membership will resume",
      },
    }),
    ...trackingFields,
  },
});
