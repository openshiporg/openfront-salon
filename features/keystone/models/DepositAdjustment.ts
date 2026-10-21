import { list } from "@keystone-6/core";
import { integer, json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const DepositAdjustment = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDepositAdjustments },
  },
  fields: {
    reversal: relationship({ ref: "TransactionReversal.depositAdjustments" }),
    paymentSession: relationship({ ref: "PaymentSession" }),
    amountDelta: integer({ validation: { isRequired: true, max: 0 } }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    postedAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
