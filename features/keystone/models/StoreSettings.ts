import { list } from "@keystone-6/core";
import { integer, relationship, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "../../lib/store-logo";
import { trackingFields } from "./trackingFields";
import { STOREFRONT_HUE_MAX, STOREFRONT_HUE_MIN } from "../../lib/storefront-theme";

export const STOREFRONT_SETTINGS_SCOPE = "storefront";

export const StoreSettings = list({
  access: {
    operation: {
      query: permissions.canManageSalon,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
  },
  isSingleton: true,
  graphql: { plural: "storeSettingsItems" },
  ui: { hideCreate: true, hideDelete: true,
    isHidden: true,
    listView: {
      initialColumns: ["name", "primaryLocation", "themeHue"],
    },
  },
  fields: {
    scope: text({
      defaultValue: STOREFRONT_SETTINGS_SCOPE,
      isIndexed: "unique",
      validation: { isRequired: true, length: { max: 40 } },
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    name: text({
      validation: { isRequired: true, length: { max: 120 } },
      ui: { description: "Public storefront name" },
    }),
    description: text({
      validation: { length: { max: 240 } },
      ui: { displayMode: "textarea", description: "Short public storefront description" },
    }),
    themeHue: integer({
      validation: { isRequired: true, min: STOREFRONT_HUE_MIN, max: STOREFRONT_HUE_MAX },
      ui: { description: "Public storefront theme hue from 0 through 359" },
    }),
    logoIcon: text({
      defaultValue: "",
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return typeof value === "string" ? sanitizeStoreLogoSvg(value) : value;
        },
        validate: ({ inputData, fieldKey, addValidationError }) => {
          const value = inputData?.[fieldKey];
          if (value && (typeof value !== "string" || !sanitizeStoreLogoSvg(value))) addValidationError("Logo must be a valid, safe SVG document");
        },
      },
    }),
    logoColor: text({
      defaultValue: "0",
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === undefined ? value : normalizeStoreLogoColor(value);
      } },
    }),
    primaryLocation: relationship({
      ref: "Location",
      many: false,
      ui: { displayMode: "select", labelField: "name", hideCreate: true },
    }),
    ...trackingFields,
  },
});
