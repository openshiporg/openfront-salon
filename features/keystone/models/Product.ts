import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  float,
  integer,
  checkbox,
  relationship,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Product = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
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

    price: float({
      validation: { isRequired: true },
      ui: {
        description: "Retail price",
      },
    }),

    cost: float({
      ui: {
        description: "Wholesale/cost price for profit tracking",
      },
    }),

    quantity: integer({
      defaultValue: 0,
      ui: {
        description: "Current stock quantity",
      },
    }),

    reorderPoint: integer({
      defaultValue: 5,
      ui: {
        description: "Minimum quantity before reorder alert",
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
  },
});
