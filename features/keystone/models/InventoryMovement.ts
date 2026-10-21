import { list } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { integer, json, relationship, select, text } from "@keystone-6/core/fields";
import { permissions } from "../access";
import { createLifecycleHooks } from "../lifecycle";
import { trackingFields } from "./trackingFields";
import { currentStockContext, stockLocationWhere } from "../inventory/locationAuthority";

export const InventoryMovement = list({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: {
      query: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }),
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: async ({ context }) => {
        try {
          // list() infers the starter's generic Context; this registered list
          // executes with the Salon Context, without altering shared tracking fields.
          const current = await currentStockContext(context as unknown as Context, "history");
          return { location: stockLocationWhere(current) };
        } catch { return false; }
      },
    },
  },
  hooks: createLifecycleHooks("inventory_movement", [
    "type", "delta", "balanceBefore", "balanceAfter", "reason", "idempotencyKey", "locationId", "productId", "appointmentId",
  ]),
  fields: {
    type: select({
      type: "enum",
      options: [
        { label: "Receive", value: "receive" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Sale", value: "sale" },
        { label: "Return", value: "return" },
      ],
      validation: { isRequired: true },
    }),
    delta: integer({ validation: { isRequired: true } }),
    balanceBefore: integer({ validation: { isRequired: true, min: 0 } }),
    balanceAfter: integer({ validation: { isRequired: true, min: 0 } }),
    reason: text({ validation: { isRequired: true, length: { max: 500 } } }),
    idempotencyKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    location: relationship({ ref: "Location.inventoryMovements" }),
    product: relationship({ ref: "Product.inventoryMovements" }),
    appointment: relationship({ ref: "Appointment.inventoryMovements" }),
    metadata: json({ defaultValue: {} }),
    ...trackingFields,
  },
});
