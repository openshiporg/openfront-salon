import { list } from "@keystone-6/core";
import {
  text,
  integer,
  checkbox,
  relationship,
} from "@keystone-6/core/fields";

import { permissions } from "../access";
import { createLifecycleHooks } from "../lifecycle";

import { trackingFields } from "./trackingFields";

export const Product = list({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    filter: {
      query: ({ session }) => (permissions.canManageInventory({ session }) || permissions.canManageCatalog({ session }) ? true : { isActive: { equals: true } }),
    },
  },
  hooks: createLifecycleHooks("product", ["name", "sku", "price", "cost", "quantity", "reorderPoint", "isActive"]),
  ui: { hideCreate: true, hideDelete: true,
    listView: {
      initialColumns: ["name", "sku", "price", "quantity", "category", "isActive"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Product name",
      },
    }),

    sku: text({
      isIndexed: "unique",
      ui: {
        description: "Stock Keeping Unit - unique product identifier",
      },
    }),

    price: integer({
      validation: { isRequired: true },
      ui: {
        description: "Retail price",
      },
    }),

    cost: integer({
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }) },
      ui: {
        description: "Wholesale/cost price for profit tracking",
      },
    }),

    quantity: integer({
      label: "Aggregate stock units across locations",
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canManagePayments({ session }) },
      defaultValue: 0,
      ui: {
        description: "Total stock units across all locations; not a location-specific sellable balance",
      },
    }),

    reorderPoint: integer({
      label: "Aggregate reorder alert quantity",
      access: { read: permissions.canManageInventory },
      defaultValue: 5,
      ui: {
        description: "Threshold evaluated against aggregate stock across locations",
      },
    }),

    category: text({
      ui: {
        description: "Product category (e.g., Shampoo, Conditioner, Styling, Color)",
      },
    }),

    description: text({
      ui: {
        displayMode: "textarea",
        description: "Product description",
      },
    }),

    image: relationship({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        inlineCreate: { fields: ["image", "altText"] },
        inlineEdit: { fields: ["image", "altText"] },
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this product is available for sale",
      },
    }),
    inventoryMovements: relationship({
      ref: "InventoryMovement.product",
      many: true,
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }) },
    }),
    ...trackingFields,
  },
});
