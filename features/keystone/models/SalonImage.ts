import { list, graphql } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import { text, json, image, select, virtual } from "@keystone-6/core/fields";

import { permissions } from "../access";

import { trackingFields } from "./trackingFields";

export const SalonImage = list({
  access: {
    operation: {
      query: () => true,
      create: (args) => permissions.canManageCatalog(args) || permissions.canManageCareRecords(args),
      update: permissions.canManageCatalog,
      delete: () => false,
    },
    filter: {
      query: (args) => permissions.canManageCareRecords(args) ? true : { visibility: { equals: "public" } },
      update: () => ({ visibility: { equals: "public" } }),
    },
  },
  ui: {
    listView: {
      initialColumns: ["altText", "imagePath", "image"],
    },
  },
  fields: {
    visibility: select({
      type: "enum", options: [{ label: "Private care record", value: "private" }, { label: "Public marketing asset", value: "public" }],
      defaultValue: "private", validation: { isRequired: true },
      access: { create: permissions.canManageCatalog, update: () => false },
      ui: { description: "Classification is permanent. Publish a separate consented marketing copy, never a care-record attachment." },
    }),
    image: image({
      storage: "my_images",
    }),
    imagePath: text({
      ui: {
        description: "Relative public image path (for example /images/services/signature-cut-blowout.svg)",
      },
    }),
    altText: text({
      ui: {
        description: "Alternative text for the image (accessibility)",
      },
    }),
    publicMetadata: virtual({ field: graphql.field({ type: graphql.JSON, resolve(item: any) {
      if (item.visibility !== "public") return null;
      const source = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      return Object.fromEntries(["placement", "title", "caption", "serviceId"].filter(key => typeof source[key] === "string").map(key => [key, source[key]]));
    } }) }),
    metadata: json({
      access: { read: (args) => permissions.canManageCatalog(args) || permissions.canManageCareRecords(args) },
      ui: {
        description: "Additional metadata about the image",
      },
    }),
    ...trackingFields,
  },
});
