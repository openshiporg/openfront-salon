import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const PaymentWebhookEvent = list({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: { initialColumns: ["provider", "eventId", "type", "status", "processedAt"] },
  },
  fields: {
    provider: relationship({ ref: "PaymentProvider.webhookEvents" }),
    replayKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    eventId: text({ validation: { isRequired: true } }),
    type: text({ validation: { isRequired: true } }),
    providerReference: text({ isIndexed: true }),
    payloadHash: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      defaultValue: "processed",
      validation: { isRequired: true },
      options: [
        { label: "Processed", value: "processed" },
        { label: "Ignored", value: "ignored" },
      ],
    }),
    data: json({ defaultValue: {} }),
    processedAt: timestamp({ defaultValue: { kind: "now" } }),
    ...trackingFields,
  },
});
