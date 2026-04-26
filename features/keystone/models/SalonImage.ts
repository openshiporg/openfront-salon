import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import { text, json, image } from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const SalonImage = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["altText", "image"],
    },
  },
  fields: {
    image: image({
      storage: "my_images",
    }),
    altText: text({
      ui: {
        description: "Alternative text for the image (accessibility)",
      },
    }),
    metadata: json({
      ui: {
        description: "Additional metadata about the image",
      },
    }),
  },
});
