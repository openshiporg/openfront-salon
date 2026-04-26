import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  checkbox,
  json,
} from "@keystone-6/core/fields";

import { isSignedIn } from "../access";

export const Location = list({
  access: {
    operation: {
      query: () => true, create: isSignedIn, update: isSignedIn, delete: isSignedIn,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "city", "state", "phone", "isActive"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      ui: {
        description: "Location/branch name",
      },
    }),

    address: text({
      validation: { isRequired: true },
      ui: {
        description: "Street address",
      },
    }),

    city: text({
      validation: { isRequired: true },
      ui: {
        description: "City",
      },
    }),

    state: text({
      validation: { isRequired: true },
      ui: {
        description: "State/Province",
      },
    }),

    zipCode: text({
      validation: { isRequired: true },
      ui: {
        description: "ZIP/Postal code",
      },
    }),

    phone: text({
      ui: {
        description: "Contact phone number",
      },
    }),

    email: text({
      ui: {
        description: "Contact email address",
      },
    }),

    hours: json({
      defaultValue: {
        monday: { open: "09:00", close: "18:00", closed: false },
        tuesday: { open: "09:00", close: "18:00", closed: false },
        wednesday: { open: "09:00", close: "18:00", closed: false },
        thursday: { open: "09:00", close: "18:00", closed: false },
        friday: { open: "09:00", close: "18:00", closed: false },
        saturday: { open: "09:00", close: "17:00", closed: false },
        sunday: { open: null, close: null, closed: true },
      },
      ui: {
        description: "Business hours by day of week (JSON object with open/close times)",
      },
    }),

    timezone: text({
      defaultValue: "America/New_York",
      ui: {
        description: "Timezone for this location (e.g., America/New_York)",
      },
    }),

    isActive: checkbox({
      defaultValue: true,
      ui: {
        description: "Whether this location is currently active and accepting appointments",
      },
    }),
  },
});
