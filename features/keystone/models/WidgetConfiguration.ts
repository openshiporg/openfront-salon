import { list } from "@keystone-6/core";
import { allOperations } from "@keystone-6/core/access";
import {
  text,
  checkbox,
} from "@keystone-6/core/fields";

import { permissions } from "../access";

import { trackingFields } from "./trackingFields";

export const WidgetConfiguration = list({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      create: permissions.canManageIntegrations,
      update: permissions.canManageIntegrations,
      delete: permissions.canManageIntegrations,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "primaryColor", "showServices", "showStylists"],
    },
  },
  fields: {
    // Widget name/identifier
    name: text({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Unique name for this widget configuration",
      },
    }),

    // Branding colors
    primaryColor: text({
      defaultValue: "#000000",
      ui: {
        description: "Primary brand color in hex format (e.g., #FF5733)",
      },
    }),

    secondaryColor: text({
      defaultValue: "#FFFFFF",
      ui: {
        description: "Secondary brand color in hex format (e.g., #333333)",
      },
    }),

    // Logo
    logoUrl: text({
      ui: {
        description: "URL to the salon logo for the widget",
      },
    }),

    // Display options
    showServices: checkbox({
      defaultValue: true,
      ui: {
        description: "Show service selection in the booking widget",
      },
    }),

    showStylists: checkbox({
      defaultValue: true,
      ui: {
        description: "Show stylist selection in the booking widget",
      },
    }),

    // Custom styling
    customCSS: text({
      ui: {
        displayMode: "textarea",
        description: "Custom CSS to override widget styles",
      },
    }),

    // Embed code (generated)
    embedCode: text({
      ui: {
        displayMode: "textarea",
        description: "Generated embed code for external websites",
      },
    }),

    // Additional settings
    buttonText: text({
      defaultValue: "Book Now",
      ui: {
        description: "Text displayed on the booking button",
      },
    }),

    welcomeMessage: text({
      ui: {
        displayMode: "textarea",
        description: "Welcome message displayed in the widget",
      },
    }),

    // Widget dimensions
    width: text({
      defaultValue: "100%",
      ui: {
        description: "Widget width (e.g., 400px, 100%)",
      },
    }),

    height: text({
      defaultValue: "600px",
      ui: {
        description: "Widget height (e.g., 600px, auto)",
      },
    }),
    ...trackingFields,
  },
});
