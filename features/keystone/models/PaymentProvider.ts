import { list } from "@keystone-6/core";
import { checkbox, json, relationship, select, text } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";
import { workflowOwned } from "../privacy";
import { stripeConfigured } from "../../integrations/payment/stripe";
import { providerUpdateProblem } from "../utils/paymentProviderActivation";

// Everything except isInstalled is set by onboarding and code, never from the dashboard.
const codeOwned = { update: () => false };

export const PaymentProvider = list({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      // Providers come from onboarding; staff with payment authority may only switch an
      // existing one on or off (isInstalled). Adapter wiring and config stay in code.
      create: () => false,
      update: permissions.canManagePayments,
      delete: () => false,
    },
  },
  hooks: {
    validateInput: ({ operation, inputData, item, addValidationError }) => {
      if (operation !== "update") return;
      const problem = providerUpdateProblem({ inputData, item: item as any, stripeKeyConfigured: stripeConfigured() });
      if (problem) addValidationError(problem);
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["name", "code", "adapter", "isInstalled", "isDefault"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true }, access: codeOwned }),
    code: text({
      access: codeOwned,
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
      access: codeOwned,
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Manual / terminal", value: "manual" },
        { label: "Stripe", value: "stripe" },
      ],
    }),
    isInstalled: checkbox({ defaultValue: false }),
    isDefault: checkbox({ defaultValue: false, access: codeOwned }),
    config: json({
      access: codeOwned,
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
