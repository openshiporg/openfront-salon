import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const PaymentSession = list({
  access: {
    operation: {
      query: ({ session }) => permissions.canManagePayments({ session }) || permissions.canIssueRefunds({ session }) || permissions.canViewReports({ session }),
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["appointment", "provider", "status", "amount", "currency", "idempotencyKey"],
    },
  },
  fields: {
    appointment: relationship({ ref: "Appointment.paymentSessions" }),
    provider: relationship({ ref: "PaymentProvider.sessions" }),
    payment: relationship({ ref: "Payment.session" }),
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    amount: integer({ validation: { isRequired: true, min: 0 } }),
    currency: text({ defaultValue: "usd", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      defaultValue: "pending",
      validation: { isRequired: true },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Requires action", value: "requires_action" },
        { label: "Authorized", value: "authorized" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Partially refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
      ],
    }),
    providerReference: text({ isIndexed: true }),
    data: json({ defaultValue: {} }),
    authorizedAt: timestamp(),
    completedAt: timestamp(),
    failedAt: timestamp(),
    refundedAt: timestamp(),
    ...trackingFields,
  },
});
