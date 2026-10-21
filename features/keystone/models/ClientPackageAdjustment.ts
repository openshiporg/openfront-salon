import { list } from "@keystone-6/core";
import { integer, json, relationship, text, timestamp } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const ClientPackageAdjustment = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadClientPackageAdjustments },
  },
  fields: {
    clientPackage: relationship({ ref: "ClientPackage.adjustments" }),
    reversal: relationship({ ref: "TransactionReversal" }),
    valueDelta: integer({ validation: { isRequired: true } }),
    reason: text({ validation: { isRequired: true, length: { max: 1000 } } }),
    actor: relationship({ ref: "User" }),
    postedAt: timestamp({ validation: { isRequired: true } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
