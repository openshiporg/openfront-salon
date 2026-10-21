import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const GratuityLedgerEntry = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadGratuityEntries },
  },
  fields: {
    payment: relationship({ ref: "Payment.gratuityEntries" }),
    reversal: relationship({ ref: "TransactionReversal.gratuityEntries" }),
    practitioner: relationship({ ref: "Stylist.gratuityEntries" }),
    type: select({ type: "enum", options: [{ label: "Allocation", value: "allocation" }, { label: "Recovery", value: "recovery" }], validation: { isRequired: true } }),
    amountDelta: integer({ validation: { isRequired: true } }),
    payoutStatus: select({ type: "enum", options: [{ label: "Payable", value: "payable" }, { label: "Paid", value: "paid" }, { label: "Recovery due", value: "recovery_due" }], validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    postedAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
