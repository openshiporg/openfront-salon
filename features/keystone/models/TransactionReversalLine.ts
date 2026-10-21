import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text } from "@keystone-6/core/fields";
import { rules } from "../access";
import { trackingFields } from "./trackingFields";

export const TransactionReversalLine = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadTransactionReversalLines },
  },
  fields: {
    reversal: relationship({ ref: "TransactionReversal.lines" }),
    sourceLine: relationship({ ref: "SalonTransactionLineItem.reversalLines" }),
    quantity: integer({ validation: { isRequired: true, min: 1 } }),
    subtotalDelta: integer({ validation: { isRequired: true, max: 0 } }),
    taxDelta: integer({ validation: { isRequired: true, max: 0 } }),
    commissionDelta: integer({ validation: { isRequired: true, max: 0 } }),
    inventoryDisposition: select({
      type: "enum",
      options: [
        { label: "Not applicable", value: "not_applicable" },
        { label: "Return to stock", value: "return_to_stock" },
        { label: "Damaged", value: "damaged" },
        { label: "Consumed", value: "consumed" },
      ],
      validation: { isRequired: true },
    }),
    inventoryMovement: relationship({ ref: "InventoryMovement" }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
