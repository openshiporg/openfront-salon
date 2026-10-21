import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

/** Append-only sale compensation header; every cents delta is signed. */
export const TransactionReversal = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadTransactionReversals },
  },
  fields: {
    transaction: relationship({ ref: "SalonTransaction.reversals" }),
    payment: relationship({ ref: "Payment.reversals" }),
    type: select({
      type: "enum",
      options: [
        { label: "Void", value: "void" },
        { label: "Refund", value: "refund" },
        { label: "Partial refund", value: "partial_refund" },
        { label: "Compensation correction", value: "compensation" },
      ],
      validation: { isRequired: true },
    }),
    status: select({ type: "enum", options: [{ label: "Posted", value: "posted" }, { label: "Provider pending", value: "provider_pending" }], validation: { isRequired: true } }),
    subtotalDelta: integer({ validation: { isRequired: true, max: 0 } }),
    taxDelta: integer({ validation: { isRequired: true, max: 0 } }),
    tipDelta: integer({ validation: { isRequired: true, max: 0 } }),
    paymentDelta: integer({ validation: { isRequired: true, max: 0 } }),
    commissionDelta: integer({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    providerReference: text({ validation: { length: { max: 500 } } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    postedAt: timestamp({ validation: { isRequired: true } }),
    conservationEvidence: json({ defaultValue: {} }),
    lines: relationship({ ref: "TransactionReversalLine.reversal", many: true }),
    commissionAdjustments: relationship({ ref: "CommissionAdjustment.reversal", many: true }),
    gratuityEntries: relationship({ ref: "GratuityLedgerEntry.reversal", many: true }),
    depositAdjustments: relationship({ ref: "DepositAdjustment.reversal", many: true }),
    ...trackingFields,
  },
});
