import { list } from "@keystone-6/core";
import { checkbox, json, relationship, select, text } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";
import { workflowOwned } from "../privacy";

export const PaymentProvider = list({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      // Provider activation is intentionally code/operator controlled until the
      // refund and reconciliation lifecycle is externally verified.
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["name", "code", "adapter", "isInstalled", "isDefault"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-z0-9_-]+$/,
          explanation: "Provider codes must start with pp_ and contain lowercase letters, numbers, underscores, or hyphens.",
        },
      },
    }),
    adapter: select({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Manual / terminal", value: "manual" },
        { label: "Stripe", value: "stripe" },
      ],
    }),
    isInstalled: checkbox({ defaultValue: false }),
    isDefault: checkbox({ defaultValue: false }),
    config: json({
      defaultValue: {},
      ui: {
        description: "Non-secret provider configuration only. API keys and webhook secrets are read from environment variables by the adapter.",
      },
    }),
    sessions: relationship({ ref: "PaymentSession.provider", many: true, access: workflowOwned }),
    webhookEvents: relationship({ ref: "PaymentWebhookEvent.provider", many: true, access: workflowOwned }),
    ...trackingFields,
  },
});
