"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core42 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
var permissions = {
  canCreateTodos: ({ session }) => session?.data.role?.canCreateTodos ?? false,
  canManageAllTodos: ({ session }) => session?.data.role?.canManageAllTodos ?? false,
  canManagePeople: ({ session }) => session?.data.role?.canManagePeople ?? false,
  canManageRoles: ({ session }) => session?.data.role?.canManageRoles ?? false,
  canAccessDashboard: ({ session }) => session?.data.role?.canAccessDashboard ?? false
};
var rules = {
  canReadTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) {
      return {
        OR: [
          { assignedTo: { id: { equals: session.itemId } } },
          { assignedTo: null, isPrivate: { equals: true } },
          { NOT: { isPrivate: { equals: true } } }
        ]
      };
    }
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canManageTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) return true;
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canEditOtherPeople) return true;
    return { id: { equals: session.itemId } };
  }
};

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      create: () => true,
      // Allow public creation for init
      query: isSignedIn,
      update: isSignedIn,
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: {
      initialColumns: ["name", "email", "role"]
    },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    name: (0, import_fields.text)({
      validation: {
        isRequired: true
      }
    }),
    email: (0, import_fields.text)({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: {
        isRequired: true
      }
    }),
    password: (0, import_fields.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManagePeople,
        update: permissions.canManagePeople
      },
      ui: {
        itemView: {
          fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read"
        }
      }
    })
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: () => true
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: {
      initialColumns: ["name", "assignedTo"]
    },
    itemView: {
      defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
    }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    canCreateTodos: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageAllTodos: (0, import_fields2.checkbox)({ defaultValue: false }),
    canSeeOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields2.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields2.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields2.checkbox)({ defaultValue: false }),
    assignedTo: (0, import_fields2.relationship)({
      ref: "User.role",
      many: true,
      ui: {
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/SalonImage.ts
var import_core3 = require("@keystone-6/core");
var import_fields3 = require("@keystone-6/core/fields");
var SalonImage = (0, import_core3.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["altText", "image"]
    }
  },
  fields: {
    image: (0, import_fields3.image)({
      storage: "my_images"
    }),
    altText: (0, import_fields3.text)({
      ui: {
        description: "Alternative text for the image (accessibility)"
      }
    }),
    metadata: (0, import_fields3.json)({
      ui: {
        description: "Additional metadata about the image"
      }
    })
  }
});

// features/keystone/models/ServiceCategory.ts
var import_core4 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var ServiceCategory = (0, import_core4.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "sortOrder", "services"]
    }
  },
  fields: {
    name: (0, import_fields4.text)({
      validation: { isRequired: true },
      ui: {
        description: "Category name (e.g., Hair, Nails, Skin, Massage, Makeup)"
      }
    }),
    description: (0, import_fields4.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    slug: (0, import_fields4.text)({
      isIndexed: "unique",
      ui: {
        description: "URL-friendly slug (auto-generated from name)"
      }
    }),
    parent: (0, import_fields4.relationship)({
      ref: "ServiceCategory",
      ui: {
        displayMode: "select",
        description: "Parent category (for subcategories)"
      }
    }),
    displayOrder: (0, import_fields4.integer)({
      defaultValue: 0,
      ui: {
        description: "Sort order for display"
      }
    }),
    // Legacy field
    sortOrder: (0, import_fields4.integer)({
      defaultValue: 0,
      ui: {
        description: "Order in which categories appear in the service menu (legacy)"
      }
    }),
    isVisible: (0, import_fields4.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this category is visible on the storefront"
      }
    }),
    icon: (0, import_fields4.text)({
      ui: {
        description: "Icon name or emoji for the category"
      }
    }),
    // Relationships
    services: (0, import_fields4.relationship)({
      ref: "Service.category",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineCreate: { fields: ["name", "basePrice", "baseDuration"] },
        inlineEdit: { fields: ["name", "basePrice", "baseDuration"] }
      }
    })
  }
});

// features/keystone/models/Service.ts
var import_core5 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
};
var Service = (0, import_core5.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "category", "basePrice", "baseDuration"]
    }
  },
  fields: {
    name: (0, import_fields5.text)({
      validation: { isRequired: true },
      ui: {
        description: "Service name (e.g., Haircut, Color, Highlights, Manicure, Facial)"
      }
    }),
    description: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    baseDuration: (0, import_fields5.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Duration in minutes"
      }
    }),
    // Price in cents for consistency with other models
    price: (0, import_fields5.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Base price in cents"
      }
    }),
    // Keep legacy float field for backwards compatibility
    basePrice: (0, import_fields5.float)({
      ui: {
        description: "Base price for the service (legacy - use price field)"
      }
    }),
    depositRequired: (0, import_fields5.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether a deposit is required to book this service"
      }
    }),
    depositAmount: (0, import_fields5.integer)({
      ui: {
        description: "Deposit amount required in cents"
      }
    }),
    status: (0, import_fields5.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" }
      ],
      defaultValue: "active"
    }),
    metadata: (0, import_fields5.json)({
      ui: {
        description: "Additional service metadata"
      }
    }),
    pricingTier: (0, import_fields5.json)({
      ui: {
        description: "Pricing by stylist tier, e.g., {junior: 50, senior: 75, master: 100}"
      }
    }),
    requiresConsultation: (0, import_fields5.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a consultation first"
      }
    }),
    requiresPatchTest: (0, import_fields5.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a patch test (e.g., for color services)"
      }
    }),
    // Relationships
    category: (0, import_fields5.relationship)({
      ref: "ServiceCategory.services",
      ui: {
        displayMode: "select"
      }
    }),
    // Image relationship (optional - for service photos)
    image: (0, import_fields5.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"]
      }
    }),
    // Stylists who specialize in this service
    specialists: (0, import_fields5.relationship)({
      ref: "Stylist.specializations",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    reviews: (0, import_fields5.relationship)({
      ref: "Review.service",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    variants: (0, import_fields5.relationship)({
      ref: "ServiceVariant.service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "price", "duration", "staffLevel"],
        inlineCreate: { fields: ["name", "price", "duration", "staffLevel", "displayOrder"] },
        inlineEdit: { fields: ["name", "price", "duration", "staffLevel", "displayOrder"] },
        description: "Pricing variants by stylist tier"
      }
    }),
    formattedPrice: (0, import_fields5.virtual)({
      field: import_core5.graphql.field({
        type: import_core5.graphql.String,
        async resolve(item, args, context) {
          const service = await context.sudo().query.Service.findOne({
            where: { id: item.id },
            query: "price"
          });
          if (!service?.price) return "$0.00";
          return formatCurrency(service.price / 100);
        }
      })
    })
  }
});

// features/keystone/models/ServiceVariant.ts
var import_core6 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var formatCurrency2 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var ServiceVariant = (0, import_core6.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "service", "price", "duration", "displayOrder"]
    },
    labelField: "name"
  },
  fields: {
    name: (0, import_fields6.text)({
      validation: { isRequired: true },
      ui: {
        description: "Variant name (e.g., Junior Stylist, Senior Stylist, Master Stylist)"
      }
    }),
    service: (0, import_fields6.relationship)({
      ref: "Service.variants",
      ui: {
        displayMode: "select",
        description: "The service this variant belongs to"
      }
    }),
    price: (0, import_fields6.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Price in cents (overrides base service price if set)"
      }
    }),
    duration: (0, import_fields6.integer)({
      ui: {
        description: "Duration in minutes (overrides base service duration if different)"
      }
    }),
    staffLevel: (0, import_fields6.text)({
      ui: {
        description: "Staff level/tier this variant applies to (e.g., junior, senior, master)"
      }
    }),
    displayOrder: (0, import_fields6.integer)({
      defaultValue: 0,
      ui: {
        description: "Order in which this variant appears"
      }
    }),
    formattedPrice: (0, import_fields6.virtual)({
      field: import_core6.graphql.field({
        type: import_core6.graphql.String,
        async resolve(item, args, context) {
          const variant = await context.sudo().query.ServiceVariant.findOne({
            where: { id: item.id },
            query: "price"
          });
          if (!variant?.price) return "$0.00";
          return formatCurrency2(variant.price);
        }
      })
    })
  }
});

// features/keystone/models/Stylist.ts
var import_core7 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var Stylist = (0, import_core7.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["user", "tier", "commissionRate", "isActive"]
    }
  },
  fields: {
    // Link to User for contact info
    user: (0, import_fields7.relationship)({
      ref: "User",
      ui: {
        displayMode: "select"
      }
    }),
    // Role field as specified in Staff Management todo
    role: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Stylist", value: "stylist" },
        { label: "Colorist", value: "colorist" },
        { label: "Nail Tech", value: "nail_tech" },
        { label: "Esthetician", value: "esthetician" },
        { label: "Massage Therapist", value: "massage_therapist" },
        { label: "Manager", value: "manager" },
        { label: "Receptionist", value: "receptionist" }
      ],
      ui: {
        description: "Staff member's primary role"
      }
    }),
    // Legacy tier field
    tier: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Junior", value: "junior" },
        { label: "Senior", value: "senior" },
        { label: "Master", value: "master" },
        { label: "Celebrity", value: "celebrity" }
      ],
      defaultValue: "junior",
      ui: {
        description: "Stylist experience tier (affects pricing) - legacy"
      }
    }),
    bio: (0, import_fields7.text)({
      ui: {
        displayMode: "textarea",
        description: "Professional biography"
      }
    }),
    // Base commission rate (percentage as float)
    baseCommissionRate: (0, import_fields7.float)({
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Base commission rate as percentage (e.g., 0.5 for 50%)"
      }
    }),
    // Legacy field
    commissionRate: (0, import_fields7.float)({
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Commission rate as decimal (legacy - use baseCommissionRate)"
      }
    }),
    certifications: (0, import_fields7.json)({
      ui: {
        description: "Array of certifications: [{name, issuer, date, expiryDate}]"
      }
    }),
    hireDate: (0, import_fields7.timestamp)({
      ui: {
        description: "Date staff member was hired"
      }
    }),
    employmentType: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Full-time", value: "full_time" },
        { label: "Part-time", value: "part_time" },
        { label: "Contractor", value: "contractor" }
      ],
      ui: {
        description: "Employment type"
      }
    }),
    status: (0, import_fields7.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "On Leave", value: "on_leave" },
        { label: "Inactive", value: "inactive" }
      ],
      defaultValue: "active",
      ui: {
        description: "Current employment status"
      }
    }),
    // Legacy field
    isActive: (0, import_fields7.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether stylist is currently active (legacy - use status)"
      }
    }),
    photoUrl: (0, import_fields7.text)({
      ui: {
        description: "URL to staff member photo"
      }
    }),
    socialMedia: (0, import_fields7.json)({
      ui: {
        description: "Social media handles: {instagram, facebook, etc}"
      }
    }),
    // Photo relationship
    photo: (0, import_fields7.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"]
      }
    }),
    // Services this stylist specializes in
    specializations: (0, import_fields7.relationship)({
      ref: "Service.specialists",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice"]
      }
    }),
    // Schedules for this stylist
    schedules: (0, import_fields7.relationship)({
      ref: "StylistSchedule.stylist",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["dayOfWeek", "startTime", "endTime", "isAvailable"]
      }
    }),
    // Appointments assigned to this stylist
    appointments: (0, import_fields7.relationship)({
      ref: "Appointment.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Clients who prefer this stylist
    preferredByClients: (0, import_fields7.relationship)({
      ref: "Client.preferredStylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Color formulas created by this stylist
    colorFormulas: (0, import_fields7.relationship)({
      ref: "ColorFormula.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Waitlist entries where this stylist is preferred
    waitlistEntries: (0, import_fields7.relationship)({
      ref: "WaitlistEntry.preferredStylists",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    reviews: (0, import_fields7.relationship)({
      ref: "Review.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    })
  }
});

// features/keystone/models/Client.ts
var import_core8 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var Client = (0, import_core8.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["user", "hairType", "preferredStylist", "totalVisits", "lifetimeValue"]
    }
  },
  fields: {
    // Link to User for contact info
    user: (0, import_fields8.relationship)({
      ref: "User",
      ui: {
        displayMode: "select"
      }
    }),
    dateOfBirth: (0, import_fields8.timestamp)({
      ui: {
        description: "Client's date of birth"
      }
    }),
    // Preferred stylist
    preferredStylist: (0, import_fields8.relationship)({
      ref: "Stylist.preferredByClients",
      ui: {
        displayMode: "select"
      }
    }),
    // Health and sensitivity information
    allergies: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Known allergies (e.g., latex, certain dyes)"
      }
    }),
    skinSensitivities: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Skin sensitivities or conditions"
      }
    }),
    skinType: (0, import_fields8.select)({
      type: "enum",
      options: [
        { label: "Oily", value: "oily" },
        { label: "Dry", value: "dry" },
        { label: "Combination", value: "combination" },
        { label: "Sensitive", value: "sensitive" }
      ],
      ui: {
        description: "Skin type"
      }
    }),
    // Hair profile
    hairType: (0, import_fields8.select)({
      type: "enum",
      options: [
        { label: "Straight", value: "straight" },
        { label: "Wavy", value: "wavy" },
        { label: "Curly", value: "curly" },
        { label: "Coily", value: "coily" }
      ],
      ui: {
        description: "Natural hair pattern"
      }
    }),
    hairTexture: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "Fine", value: "fine" },
        { label: "Medium", value: "medium" },
        { label: "Coarse", value: "coarse" }
      ],
      ui: {
        description: "Hair thickness/texture"
      }
    }),
    scalpCondition: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Dry", value: "dry" },
        { label: "Oily", value: "oily" },
        { label: "Sensitive", value: "sensitive" }
      ],
      ui: {
        description: "Scalp condition"
      }
    }),
    // Internal notes
    notes: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Internal notes about client preferences and history"
      }
    }),
    // Visit tracking
    firstVisit: (0, import_fields8.timestamp)({
      ui: {
        description: "Date of first visit"
      }
    }),
    lastVisit: (0, import_fields8.timestamp)({
      ui: {
        description: "Date of most recent visit"
      }
    }),
    totalVisits: (0, import_fields8.integer)({
      defaultValue: 0,
      ui: {
        description: "Total number of visits"
      }
    }),
    lifetimeValue: (0, import_fields8.float)({
      defaultValue: 0,
      ui: {
        description: "Total revenue from this client"
      }
    }),
    // Consent
    photoConsent: (0, import_fields8.checkbox)({
      defaultValue: false,
      ui: {
        description: "Consent to use photos for marketing"
      }
    }),
    marketingConsent: (0, import_fields8.checkbox)({
      defaultValue: false,
      ui: {
        description: "Consent to receive marketing communications"
      }
    }),
    // Relationships
    appointments: (0, import_fields8.relationship)({
      ref: "Appointment.client",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    colorFormulas: (0, import_fields8.relationship)({
      ref: "ColorFormula.client",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["formulaName", "createdAt"]
      }
    }),
    reviews: (0, import_fields8.relationship)({
      ref: "Review.client",
      many: true,
      ui: {
        displayMode: "count"
      }
    })
  }
});

// features/keystone/models/ClientNote.ts
var import_core9 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var ClientNote = (0, import_core9.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "author", "isPrivate", "createdAt"]
    }
  },
  fields: {
    client: (0, import_fields9.relationship)({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client this note is about"
      }
    }),
    author: (0, import_fields9.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who wrote this note"
      }
    }),
    content: (0, import_fields9.text)({
      ui: {
        displayMode: "textarea",
        description: "Note content"
      },
      validation: {
        isRequired: true
      }
    }),
    isPrivate: (0, import_fields9.checkbox)({
      defaultValue: true,
      ui: {
        description: "Visible only to staff (not shown to client)"
      }
    }),
    appointment: (0, import_fields9.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Related appointment (if any)"
      }
    }),
    photos: (0, import_fields9.relationship)({
      ref: "SalonImage",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        description: "Before/after photos"
      }
    }),
    createdAt: (0, import_fields9.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    updatedAt: (0, import_fields9.timestamp)({
      db: { updatedAt: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/ColorFormula.ts
var import_core10 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var ColorFormula = (0, import_core10.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["formulaName", "client", "stylist", "createdAt"]
    }
  },
  fields: {
    formulaName: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name for this formula (e.g., Summer Blonde 2024)"
      }
    }),
    // Products and ratios
    products: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "List of products/colors used"
      }
    }),
    measurements: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Exact ratios and measurements (e.g., 30ml A + 15ml B)"
      }
    }),
    processingTime: (0, import_fields10.integer)({
      ui: {
        description: "Processing time in minutes"
      }
    }),
    result: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "How the color turned out, notes for future reference"
      }
    }),
    createdAt: (0, import_fields10.timestamp)({
      defaultValue: { kind: "now" }
    }),
    // Relationships
    client: (0, import_fields10.relationship)({
      ref: "Client.colorFormulas",
      ui: {
        displayMode: "select"
      }
    }),
    stylist: (0, import_fields10.relationship)({
      ref: "Stylist.colorFormulas",
      ui: {
        displayMode: "select"
      }
    }),
    // Appointment when this formula was applied
    appointment: (0, import_fields10.relationship)({
      ref: "Appointment.colorFormula",
      ui: {
        displayMode: "select"
      }
    }),
    // Before/after photo
    photo: (0, import_fields10.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"]
      }
    })
  }
});

// features/keystone/models/StylistSchedule.ts
var import_core11 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var StylistSchedule = (0, import_core11.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["stylist", "dayOfWeek", "startTime", "endTime", "isAvailable"]
    }
  },
  fields: {
    type: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Recurring", value: "recurring" },
        { label: "One-time", value: "one_time" },
        { label: "Time-off", value: "time_off" }
      ],
      defaultValue: "recurring",
      validation: {
        isRequired: true
      }
    }),
    // Day of week for recurring schedules (0-6, Sunday = 0)
    dayOfWeek: (0, import_fields11.integer)({
      validation: {
        min: 0,
        max: 6
      },
      ui: {
        description: "Day of week (0=Sunday, 1=Monday, etc) for recurring schedules"
      }
    }),
    // Legacy string-based day of week
    dayOfWeekLegacy: (0, import_fields11.select)({
      type: "enum",
      options: [
        { label: "Monday", value: "monday" },
        { label: "Tuesday", value: "tuesday" },
        { label: "Wednesday", value: "wednesday" },
        { label: "Thursday", value: "thursday" },
        { label: "Friday", value: "friday" },
        { label: "Saturday", value: "saturday" },
        { label: "Sunday", value: "sunday" }
      ]
    }),
    // Date for one-time or time-off entries
    date: (0, import_fields11.timestamp)({
      ui: {
        description: "Specific date for one-time schedule or time-off"
      }
    }),
    startTime: (0, import_fields11.text)({
      validation: { isRequired: true },
      ui: {
        description: "Start time in HH:MM format (e.g., 09:00)"
      }
    }),
    endTime: (0, import_fields11.text)({
      validation: { isRequired: true },
      ui: {
        description: "End time in HH:MM format (e.g., 17:00)"
      }
    }),
    isAvailable: (0, import_fields11.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether stylist is available on this day (false for time off)"
      }
    }),
    // Break times
    breakStart: (0, import_fields11.text)({
      ui: {
        description: "Lunch/break start time in HH:MM format"
      }
    }),
    breakEnd: (0, import_fields11.text)({
      ui: {
        description: "Lunch/break end time in HH:MM format"
      }
    }),
    reason: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for time-off or special schedule"
      }
    }),
    // Schedule validity period
    effectiveFrom: (0, import_fields11.timestamp)({
      ui: {
        description: "When this schedule starts being effective"
      }
    }),
    effectiveTo: (0, import_fields11.timestamp)({
      ui: {
        description: "When this schedule ends (null for ongoing recurring schedules)"
      }
    }),
    // Legacy fields
    effectiveDate: (0, import_fields11.timestamp)({
      ui: {
        description: "When this schedule starts being effective (legacy - use effectiveFrom)"
      }
    }),
    endDate: (0, import_fields11.timestamp)({
      ui: {
        description: "When this schedule ends (legacy - use effectiveTo)"
      }
    }),
    // Relationship to stylist
    stylist: (0, import_fields11.relationship)({
      ref: "Stylist.schedules",
      ui: {
        displayMode: "select"
      }
    })
  }
});

// features/keystone/models/Appointment.ts
var import_core12 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var Appointment = (0, import_core12.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "stylist", "startTime", "status", "duration"]
    }
  },
  fields: {
    startTime: (0, import_fields12.timestamp)({
      validation: { isRequired: true },
      ui: {
        description: "Start date and time of the appointment"
      }
    }),
    endTime: (0, import_fields12.timestamp)({
      ui: {
        description: "End date and time of the appointment"
      }
    }),
    duration: (0, import_fields12.integer)({
      defaultValue: 60,
      ui: {
        description: "Total duration in minutes"
      }
    }),
    status: (0, import_fields12.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "No-show", value: "no_show" }
      ],
      defaultValue: "pending",
      validation: {
        isRequired: true
      }
    }),
    depositAmount: (0, import_fields12.integer)({
      ui: {
        description: "Deposit amount required in cents"
      }
    }),
    depositPaid: (0, import_fields12.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether deposit has been paid"
      }
    }),
    metadata: (0, import_fields12.json)({
      ui: {
        description: "Additional metadata for the appointment"
      }
    }),
    // Timestamps
    bookedAt: (0, import_fields12.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the appointment was booked"
      }
    }),
    confirmedAt: (0, import_fields12.timestamp)({
      ui: {
        description: "When the appointment was confirmed"
      }
    }),
    cancelledAt: (0, import_fields12.timestamp)({
      ui: {
        description: "When the appointment was cancelled"
      }
    }),
    cancellationReason: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for cancellation"
      }
    }),
    // Notes
    notes: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes and special requests"
      }
    }),
    clientNotes: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Special requests from client"
      }
    }),
    internalNotes: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Internal notes for stylists"
      }
    }),
    // Relationships
    client: (0, import_fields12.relationship)({
      ref: "Client.appointments",
      ui: {
        displayMode: "select"
      }
    }),
    stylist: (0, import_fields12.relationship)({
      ref: "Stylist.appointments",
      ui: {
        displayMode: "select"
      }
    }),
    // Services booked for this appointment (can book multiple)
    services: (0, import_fields12.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"]
      }
    }),
    // Line items for detailed service tracking
    lineItems: (0, import_fields12.relationship)({
      ref: "AppointmentLineItem.appointment",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["service", "staff", "duration", "formattedPrice"]
      }
    }),
    // Color formula applied during this appointment
    colorFormula: (0, import_fields12.relationship)({
      ref: "ColorFormula.appointment",
      ui: {
        displayMode: "select"
      }
    }),
    // Payment for this appointment
    payment: (0, import_fields12.relationship)({
      ref: "Payment.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["totalAmount", "status", "paymentMethod"]
      }
    }),
    // Review for this appointment
    review: (0, import_fields12.relationship)({
      ref: "Review.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["rating", "comment", "isApproved"]
      }
    }),
    ...(0, import_core12.group)({
      label: "Virtual Fields",
      description: "Calculated fields for appointment display",
      fields: {
        formattedDuration: (0, import_fields12.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.String,
            async resolve(item, args, context) {
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
                query: "duration"
              });
              if (!appointment?.duration) return "0 min";
              const hours = Math.floor(appointment.duration / 60);
              const minutes = appointment.duration % 60;
              if (hours === 0) return `${minutes} min`;
              if (minutes === 0) return `${hours} hr`;
              return `${hours} hr ${minutes} min`;
            }
          })
        }),
        isUpcoming: (0, import_fields12.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.Boolean,
            async resolve(item, args, context) {
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
                query: "startTime status"
              });
              if (!appointment?.startTime) return false;
              if (appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "no_show") {
                return false;
              }
              return new Date(appointment.startTime) > /* @__PURE__ */ new Date();
            }
          })
        }),
        isPast: (0, import_fields12.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.Boolean,
            async resolve(item, args, context) {
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: item.id },
                query: "startTime"
              });
              if (!appointment?.startTime) return false;
              return new Date(appointment.startTime) < /* @__PURE__ */ new Date();
            }
          })
        })
      }
    })
  }
});

// features/keystone/models/AppointmentLineItem.ts
var import_core13 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var formatCurrency3 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var AppointmentLineItem = (0, import_core13.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["service", "staff", "duration", "price", "appointment"]
    }
  },
  fields: {
    service: (0, import_fields13.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service being provided"
      }
    }),
    staff: (0, import_fields13.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member providing this service"
      }
    }),
    duration: (0, import_fields13.integer)({
      defaultValue: 60,
      ui: {
        description: "Duration of this service in minutes"
      }
    }),
    price: (0, import_fields13.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Price in cents"
      }
    }),
    quantity: (0, import_fields13.integer)({
      defaultValue: 1,
      validation: { isRequired: true },
      ui: {
        description: "Quantity of this service (usually 1)"
      }
    }),
    notes: (0, import_fields13.text)({
      ui: {
        displayMode: "textarea",
        description: "Special requests or notes for this service"
      }
    }),
    appointment: (0, import_fields13.relationship)({
      ref: "Appointment.lineItems",
      ui: {
        displayMode: "select",
        description: "Related appointment"
      }
    }),
    metadata: (0, import_fields13.json)({
      ui: {
        description: "Additional metadata for the line item"
      }
    }),
    formattedPrice: (0, import_fields13.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: item.id },
            query: "price"
          });
          if (!lineItem?.price) return "$0.00";
          return formatCurrency3(lineItem.price);
        }
      })
    }),
    formattedTotal: (0, import_fields13.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: item.id },
            query: "price quantity"
          });
          if (!lineItem?.price || !lineItem?.quantity) return "$0.00";
          const total = lineItem.price * lineItem.quantity;
          return formatCurrency3(total);
        }
      })
    })
  }
});

// features/keystone/models/Payment.ts
var import_core14 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var Payment = (0, import_core14.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["appointment", "totalAmount", "paymentMethod", "status", "processedAt"]
    }
  },
  fields: {
    // Core amount fields
    subtotal: (0, import_fields14.float)({
      validation: { isRequired: true },
      ui: {
        description: "Service charges before tax and tip"
      }
    }),
    tax: (0, import_fields14.float)({
      defaultValue: 0,
      ui: {
        description: "Tax amount"
      }
    }),
    tip: (0, import_fields14.float)({
      defaultValue: 0,
      ui: {
        description: "Tip amount"
      }
    }),
    discount: (0, import_fields14.float)({
      defaultValue: 0,
      ui: {
        description: "Any discount applied"
      }
    }),
    totalAmount: (0, import_fields14.float)({
      validation: { isRequired: true },
      ui: {
        description: "Total amount charged (subtotal + tax + tip - discount)"
      }
    }),
    // Payment method and processing
    paymentMethod: (0, import_fields14.select)({
      type: "string",
      options: [
        { label: "Credit Card", value: "credit_card" },
        { label: "Debit Card", value: "debit_card" },
        { label: "Cash", value: "cash" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Apple Pay", value: "apple_pay" },
        { label: "Google Pay", value: "google_pay" }
      ],
      defaultValue: "credit_card",
      validation: { isRequired: true }
    }),
    status: (0, import_fields14.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Partially Refunded", value: "partially_refunded" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    // Stripe integration fields
    stripePaymentIntentId: (0, import_fields14.text)({
      ui: {
        description: "Stripe Payment Intent ID for card payments"
      }
    }),
    stripeChargeId: (0, import_fields14.text)({
      ui: {
        description: "Stripe Charge ID for completed payments"
      }
    }),
    stripeRefundId: (0, import_fields14.text)({
      ui: {
        description: "Stripe Refund ID if payment was refunded"
      }
    }),
    // Card details (last 4 digits, brand)
    cardBrand: (0, import_fields14.text)({
      ui: {
        description: "Card brand (Visa, Mastercard, etc.)"
      }
    }),
    cardLast4: (0, import_fields14.text)({
      ui: {
        description: "Last 4 digits of card"
      }
    }),
    // Refund tracking
    refundedAmount: (0, import_fields14.float)({
      defaultValue: 0,
      ui: {
        description: "Amount refunded"
      }
    }),
    refundReason: (0, import_fields14.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for refund if applicable"
      }
    }),
    // Tip distribution
    tipDistributed: (0, import_fields14.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether tip has been distributed to stylist"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields14.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the payment record was created"
      }
    }),
    processedAt: (0, import_fields14.timestamp)({
      ui: {
        description: "When the payment was successfully processed"
      }
    }),
    refundedAt: (0, import_fields14.timestamp)({
      ui: {
        description: "When the refund was processed"
      }
    }),
    // Notes
    notes: (0, import_fields14.text)({
      ui: {
        displayMode: "textarea",
        description: "Internal notes about the payment"
      }
    }),
    // Relationships
    appointment: (0, import_fields14.relationship)({
      ref: "Appointment.payment",
      ui: {
        displayMode: "select"
      }
    }),
    // Processed by (staff member who processed the payment)
    processedBy: (0, import_fields14.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed this payment"
      }
    }),
    // Receipt tracking
    receiptSent: (0, import_fields14.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether receipt email was sent to client"
      }
    }),
    receiptEmail: (0, import_fields14.text)({
      ui: {
        description: "Email address receipt was sent to"
      }
    })
  }
});

// features/keystone/models/ClientPoints.ts
var import_core15 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var ClientPoints = (0, import_core15.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  graphql: {
    plural: "ClientPointsRecords"
  },
  ui: {
    listView: {
      initialColumns: ["client", "points", "tier"]
    }
  },
  fields: {
    // Link to User/Client
    client: (0, import_fields15.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "The client who owns these points"
      }
    }),
    // Current points balance
    points: (0, import_fields15.integer)({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: {
        description: "Current loyalty points balance"
      }
    }),
    // Loyalty tier based on points
    tier: (0, import_fields15.text)({
      defaultValue: "bronze",
      ui: {
        description: "Loyalty tier (e.g., bronze, silver, gold, platinum)"
      }
    }),
    // Transaction history stored as JSON array
    // Each transaction: { date: string, amount: number, reason: string }
    transactions: (0, import_fields15.json)({
      defaultValue: [],
      ui: {
        description: "Array of point transactions with date, amount, and reason",
        views: "./features/keystone/fields/json-view",
        createView: { fieldMode: "hidden" }
      }
    })
  }
});

// features/keystone/models/Referral.ts
var import_core16 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var Referral = (0, import_core16.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["referrer", "referred", "rewardAmount", "rewardType", "status"]
    }
  },
  fields: {
    // The user who made the referral
    referrer: (0, import_fields16.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "The client who made the referral"
      }
    }),
    // The new user who was referred
    referred: (0, import_fields16.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "The new client who was referred"
      }
    }),
    // Reward details
    rewardAmount: (0, import_fields16.float)({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: {
        description: "Amount of reward (points or credit value)"
      }
    }),
    rewardType: (0, import_fields16.select)({
      type: "string",
      options: [
        { label: "Points", value: "points" },
        { label: "Credit", value: "credit" }
      ],
      defaultValue: "points",
      validation: { isRequired: true },
      ui: {
        description: "Type of reward given for the referral"
      }
    }),
    // Referral status
    status: (0, import_fields16.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Completed", value: "completed" },
        { label: "Expired", value: "expired" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
      ui: {
        description: "Current status of the referral"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields16.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the referral was created"
      }
    }),
    completedAt: (0, import_fields16.timestamp)({
      ui: {
        description: "When the referral was completed (referred client made first purchase)"
      }
    })
  }
});

// features/keystone/models/MessageTemplate.ts
var import_core17 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var MessageTemplate = (0, import_core17.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields17.text)({
      validation: { isRequired: true },
      ui: {
        description: "Template name for identification"
      }
    }),
    type: (0, import_fields17.select)({
      type: "string",
      options: [
        { label: "Reminder", value: "reminder" },
        { label: "Confirmation", value: "confirmation" },
        { label: "Marketing", value: "marketing" }
      ],
      validation: { isRequired: true },
      ui: {
        description: "Type of message template"
      }
    }),
    content: (0, import_fields17.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
        description: "Message content with variables like {{clientName}}, {{appointmentDate}}, {{stylistName}}"
      }
    }),
    variables: (0, import_fields17.json)({
      ui: {
        description: 'Available variables for this template, e.g., ["clientName", "appointmentDate", "stylistName"]'
      }
    }),
    isActive: (0, import_fields17.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this template is currently active and available for use"
      }
    })
  }
});

// features/keystone/models/MessageLog.ts
var import_core18 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var MessageLog = (0, import_core18.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["recipient", "template", "sentAt", "channel", "status"]
    }
  },
  fields: {
    // Recipient of the message
    recipient: (0, import_fields18.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "User who received this message"
      }
    }),
    // Template used for this message
    template: (0, import_fields18.relationship)({
      ref: "MessageTemplate",
      ui: {
        displayMode: "select",
        description: "Message template used"
      }
    }),
    sentAt: (0, import_fields18.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the message was sent"
      }
    }),
    channel: (0, import_fields18.select)({
      type: "string",
      options: [
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Push Notification", value: "push" }
      ],
      validation: { isRequired: true },
      ui: {
        description: "Communication channel used to send the message"
      }
    }),
    status: (0, import_fields18.select)({
      type: "string",
      options: [
        { label: "Sent", value: "sent" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" }
      ],
      defaultValue: "sent",
      ui: {
        description: "Delivery status of the message"
      }
    }),
    errorMessage: (0, import_fields18.text)({
      ui: {
        displayMode: "textarea",
        description: "Error details if the message failed to deliver"
      }
    })
  }
});

// features/keystone/models/GiftCard.ts
var import_core19 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var GiftCard = (0, import_core19.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["code", "initialValue", "currentBalance", "recipientName", "isActive", "expiresAt"]
    }
  },
  fields: {
    // Unique gift card code
    code: (0, import_fields19.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Unique gift card code for redemption"
      }
    }),
    // Value fields
    initialValue: (0, import_fields19.float)({
      validation: { isRequired: true },
      ui: {
        description: "Original value of the gift card when purchased"
      }
    }),
    currentBalance: (0, import_fields19.float)({
      validation: { isRequired: true },
      ui: {
        description: "Current remaining balance on the gift card"
      }
    }),
    // Recipient information
    recipientEmail: (0, import_fields19.text)({
      ui: {
        description: "Email address of the gift card recipient"
      }
    }),
    recipientName: (0, import_fields19.text)({
      ui: {
        description: "Name of the gift card recipient"
      }
    }),
    // Personal message
    message: (0, import_fields19.text)({
      ui: {
        displayMode: "textarea",
        description: "Personal message from purchaser to recipient"
      }
    }),
    // Expiration and status
    expiresAt: (0, import_fields19.timestamp)({
      ui: {
        description: "Expiration date of the gift card"
      }
    }),
    isActive: (0, import_fields19.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether the gift card is currently active and can be redeemed"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields19.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the gift card was created"
      }
    }),
    // Relationships
    purchasedBy: (0, import_fields19.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "User who purchased this gift card"
      }
    }),
    // Transactions on this gift card
    transactions: (0, import_fields19.relationship)({
      ref: "GiftCardTransaction.giftCard",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["amount", "type", "createdAt"],
        description: "Transaction history for this gift card"
      }
    })
  }
});

// features/keystone/models/GiftCardTransaction.ts
var import_core20 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var GiftCardTransaction = (0, import_core20.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["giftCard", "amount", "type", "createdAt"]
    }
  },
  fields: {
    // Transaction amount
    amount: (0, import_fields20.float)({
      validation: { isRequired: true },
      ui: {
        description: "Transaction amount (positive for purchase/refund, negative for redemption)"
      }
    }),
    // Transaction type
    type: (0, import_fields20.select)({
      type: "string",
      options: [
        { label: "Purchase", value: "purchase" },
        { label: "Redemption", value: "redemption" },
        { label: "Refund", value: "refund" }
      ],
      validation: { isRequired: true },
      ui: {
        description: "Type of transaction"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields20.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the transaction occurred"
      }
    }),
    // Notes
    notes: (0, import_fields20.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about this transaction"
      }
    }),
    // Relationships
    giftCard: (0, import_fields20.relationship)({
      ref: "GiftCard.transactions",
      ui: {
        displayMode: "select",
        description: "Gift card this transaction belongs to"
      }
    }),
    // Optional appointment (for redemptions)
    appointment: (0, import_fields20.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Appointment this redemption was applied to (if applicable)"
      }
    })
  }
});

// features/keystone/models/ClientMembership.ts
var import_core21 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var ClientMembership = (0, import_core21.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "membership", "status", "startDate", "nextBillingDate"]
    }
  },
  fields: {
    // Link to User (client)
    client: (0, import_fields21.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "The client who holds this membership"
      }
    }),
    // Link to Membership plan
    membership: (0, import_fields21.relationship)({
      ref: "Membership",
      ui: {
        displayMode: "select",
        description: "The membership plan"
      }
    }),
    // Membership dates
    startDate: (0, import_fields21.timestamp)({
      validation: { isRequired: true },
      ui: {
        description: "When the membership started"
      }
    }),
    nextBillingDate: (0, import_fields21.timestamp)({
      ui: {
        description: "Next billing date for recurring memberships"
      }
    }),
    // Membership status
    status: (0, import_fields21.select)({
      type: "string",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Cancelled", value: "cancelled" }
      ],
      ui: {
        displayMode: "segmented-control",
        description: "Current status of the membership"
      }
    }),
    // Pause management
    pausedUntil: (0, import_fields21.timestamp)({
      ui: {
        description: "If paused, when the membership will resume"
      }
    })
  }
});

// features/keystone/models/IntakeForm.ts
var import_core22 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var IntakeForm = (0, import_core22.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "isActive", "requiredForServices"]
    }
  },
  fields: {
    name: (0, import_fields22.text)({
      validation: { isRequired: true },
      ui: {
        description: "Form name (e.g., New Client Intake, Color Consultation)"
      }
    }),
    // JSON schema for form fields
    fields: (0, import_fields22.json)({
      ui: {
        description: "JSON schema defining form fields, e.g., [{name: 'allergies', type: 'text', required: true}, {name: 'hairGoals', type: 'textarea'}]"
      }
    }),
    // Services that require this form
    requiredForServices: (0, import_fields22.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "select",
        description: "Services that require this intake form to be completed"
      }
    }),
    // Whether the form is currently active
    isActive: (0, import_fields22.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this form is currently in use"
      }
    }),
    // Submissions of this form
    submissions: (0, import_fields22.relationship)({
      ref: "FormSubmission.form",
      many: true,
      ui: {
        displayMode: "count"
      }
    })
  }
});

// features/keystone/models/ServicePackage.ts
var import_core23 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var ServicePackage = (0, import_core23.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "totalPrice", "savingsAmount", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields23.text)({
      validation: { isRequired: true },
      ui: {
        description: "Package name (e.g., Bridal Package, Spa Day Package)"
      }
    }),
    description: (0, import_fields23.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed description of what's included in the package"
      }
    }),
    totalPrice: (0, import_fields23.float)({
      validation: { isRequired: true },
      ui: {
        description: "Total package price"
      }
    }),
    savingsAmount: (0, import_fields23.float)({
      defaultValue: 0,
      ui: {
        description: "Amount saved compared to booking services individually"
      }
    }),
    validDays: (0, import_fields23.integer)({
      defaultValue: 30,
      ui: {
        description: "Number of days the package is valid after purchase"
      }
    }),
    isActive: (0, import_fields23.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this package is currently available for purchase"
      }
    }),
    // Relationships
    services: (0, import_fields23.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included in this package"
      }
    })
  }
});

// features/keystone/models/Membership.ts
var import_core24 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");
var Membership = (0, import_core24.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "monthlyPrice", "discountPercent", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields24.text)({
      validation: { isRequired: true },
      ui: {
        description: "Membership tier name (e.g., Bronze, Silver, Gold, Platinum)"
      }
    }),
    description: (0, import_fields24.text)({
      ui: {
        displayMode: "textarea",
        description: "Description of membership benefits and perks"
      }
    }),
    monthlyPrice: (0, import_fields24.float)({
      validation: { isRequired: true },
      ui: {
        description: "Monthly membership fee"
      }
    }),
    discountPercent: (0, import_fields24.integer)({
      defaultValue: 0,
      validation: { min: 0, max: 100 },
      ui: {
        description: "Percentage discount on services (0-100)"
      }
    }),
    isActive: (0, import_fields24.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this membership is currently available"
      }
    }),
    // Relationships
    includedServices: (0, import_fields24.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included for free or at a discount with this membership"
      }
    })
  }
});

// features/keystone/models/FormSubmission.ts
var import_core25 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var FormSubmission = (0, import_core25.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "form", "submittedAt", "appointment"]
    }
  },
  fields: {
    // Form data stored as JSON
    data: (0, import_fields25.json)({
      ui: {
        description: "Form field responses as JSON object"
      }
    }),
    // Digital signature
    signature: (0, import_fields25.text)({
      ui: {
        displayMode: "textarea",
        description: "Client's digital signature (base64 encoded or signature data)"
      }
    }),
    // Submission timestamp
    submittedAt: (0, import_fields25.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the form was submitted"
      }
    }),
    // Relationships
    client: (0, import_fields25.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Client who submitted the form"
      }
    }),
    form: (0, import_fields25.relationship)({
      ref: "IntakeForm.submissions",
      ui: {
        displayMode: "select",
        description: "The intake form template that was filled out (legacy)"
      }
    }),
    template: (0, import_fields25.relationship)({
      ref: "FormTemplate.submissions",
      ui: {
        displayMode: "select",
        description: "The form template that was filled out"
      }
    }),
    // Optional link to appointment
    appointment: (0, import_fields25.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (if applicable)"
      }
    })
  }
});

// features/keystone/models/FormTemplate.ts
var import_core26 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var FormTemplate = (0, import_core26.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive", "requiredForCategories"]
    }
  },
  fields: {
    name: (0, import_fields26.text)({
      validation: { isRequired: true },
      ui: {
        description: "Form name (e.g., New Client Intake, Color Service Consent)"
      }
    }),
    type: (0, import_fields26.select)({
      type: "string",
      options: [
        { label: "Intake", value: "intake" },
        { label: "Consent", value: "consent" },
        { label: "Medical", value: "medical" },
        { label: "Waiver", value: "waiver" }
      ],
      defaultValue: "intake",
      ui: {
        displayMode: "select",
        description: "Type of form"
      }
    }),
    description: (0, import_fields26.text)({
      ui: {
        displayMode: "textarea",
        description: "Description of the form's purpose"
      }
    }),
    fields: (0, import_fields26.json)({
      ui: {
        description: `JSON array of field definitions: [{id, type (text/textarea/checkbox/radio/select/signature/file), label, required, options (for select/radio), validation}]`
      }
    }),
    isActive: (0, import_fields26.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this form is currently active"
      }
    }),
    requiredForCategories: (0, import_fields26.relationship)({
      ref: "ServiceCategory",
      many: true,
      ui: {
        displayMode: "select",
        description: "Service categories that require this form"
      }
    }),
    submissions: (0, import_fields26.relationship)({
      ref: "FormSubmission.template",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    metadata: (0, import_fields26.json)({
      ui: {
        description: "Additional form metadata"
      }
    })
  }
});

// features/keystone/models/LoyaltyProgram.ts
var import_core27 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var LoyaltyProgram = (0, import_core27.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "pointsPerDollar", "redemptionRate", "isActive"]
    }
  },
  fields: {
    // Program name
    name: (0, import_fields27.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the loyalty program"
      }
    }),
    // Points configuration
    pointsPerDollar: (0, import_fields27.float)({
      validation: { isRequired: true },
      defaultValue: 1,
      ui: {
        description: "Number of points earned per dollar spent"
      }
    }),
    redemptionRate: (0, import_fields27.float)({
      validation: { isRequired: true },
      defaultValue: 0.01,
      ui: {
        description: "Dollar value per point when redeeming (e.g., 0.01 = 1 cent per point)"
      }
    }),
    // Tier configuration stored as JSON array
    // Example: [{ name: "Bronze", minPoints: 0, benefits: ["5% off"] }, { name: "Gold", minPoints: 1000, benefits: ["10% off", "Free shipping"] }]
    tiers: (0, import_fields27.json)({
      ui: {
        description: "Tier configuration as JSON array with name, minPoints, and benefits for each tier"
      }
    }),
    // Program status
    isActive: (0, import_fields27.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this loyalty program is currently active"
      }
    })
  }
});

// features/keystone/models/WaitlistEntry.ts
var import_core28 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");
var WaitlistEntry = (0, import_core28.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "service", "isActive", "dateRangeStart", "dateRangeEnd"]
    }
  },
  fields: {
    // Client requesting the appointment
    client: (0, import_fields28.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Client waiting for an appointment"
      }
    }),
    // Service they want to book
    service: (0, import_fields28.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service the client wants to book"
      }
    }),
    // Preferred stylists (many-to-many)
    preferredStylists: (0, import_fields28.relationship)({
      ref: "Stylist.waitlistEntries",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["user", "tier"],
        description: "Stylists the client would prefer"
      }
    }),
    // Preferred days of the week
    preferredDays: (0, import_fields28.json)({
      ui: {
        description: 'Preferred days of week as JSON array, e.g., ["monday", "wednesday", "friday"]'
      }
    }),
    // Preferred time range
    preferredTimeRange: (0, import_fields28.text)({
      ui: {
        description: 'Preferred time range, e.g., "9:00-12:00" or "morning" or "afternoon"'
      }
    }),
    // Date range the client is available
    dateRangeStart: (0, import_fields28.timestamp)({
      ui: {
        description: "Start of date range the client is available"
      }
    }),
    dateRangeEnd: (0, import_fields28.timestamp)({
      ui: {
        description: "End of date range the client is available"
      }
    }),
    // Status
    isActive: (0, import_fields28.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this waitlist entry is still active"
      }
    }),
    // When the client was notified of availability
    notifiedAt: (0, import_fields28.timestamp)({
      ui: {
        description: "When the client was notified that a slot became available"
      }
    }),
    // Notes
    notes: (0, import_fields28.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes or special requests"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields28.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    })
  }
});

// features/keystone/models/WidgetConfiguration.ts
var import_core29 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var WidgetConfiguration = (0, import_core29.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "primaryColor", "showServices", "showStylists"]
    }
  },
  fields: {
    // Widget name/identifier
    name: (0, import_fields29.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Unique name for this widget configuration"
      }
    }),
    // Branding colors
    primaryColor: (0, import_fields29.text)({
      defaultValue: "#000000",
      ui: {
        description: "Primary brand color in hex format (e.g., #FF5733)"
      }
    }),
    secondaryColor: (0, import_fields29.text)({
      defaultValue: "#FFFFFF",
      ui: {
        description: "Secondary brand color in hex format (e.g., #333333)"
      }
    }),
    // Logo
    logoUrl: (0, import_fields29.text)({
      ui: {
        description: "URL to the salon logo for the widget"
      }
    }),
    // Display options
    showServices: (0, import_fields29.checkbox)({
      defaultValue: true,
      ui: {
        description: "Show service selection in the booking widget"
      }
    }),
    showStylists: (0, import_fields29.checkbox)({
      defaultValue: true,
      ui: {
        description: "Show stylist selection in the booking widget"
      }
    }),
    // Custom styling
    customCSS: (0, import_fields29.text)({
      ui: {
        displayMode: "textarea",
        description: "Custom CSS to override widget styles"
      }
    }),
    // Embed code (generated)
    embedCode: (0, import_fields29.text)({
      ui: {
        displayMode: "textarea",
        description: "Generated embed code for external websites"
      }
    }),
    // Additional settings
    buttonText: (0, import_fields29.text)({
      defaultValue: "Book Now",
      ui: {
        description: "Text displayed on the booking button"
      }
    }),
    welcomeMessage: (0, import_fields29.text)({
      ui: {
        displayMode: "textarea",
        description: "Welcome message displayed in the widget"
      }
    }),
    // Widget dimensions
    width: (0, import_fields29.text)({
      defaultValue: "100%",
      ui: {
        description: "Widget width (e.g., 400px, 100%)"
      }
    }),
    height: (0, import_fields29.text)({
      defaultValue: "600px",
      ui: {
        description: "Widget height (e.g., 600px, auto)"
      }
    })
  }
});

// features/keystone/models/Location.ts
var import_core30 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var Location = (0, import_core30.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "city", "state", "phone", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "Location/branch name"
      }
    }),
    address: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "Street address"
      }
    }),
    city: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "City"
      }
    }),
    state: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "State/Province"
      }
    }),
    zipCode: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "ZIP/Postal code"
      }
    }),
    phone: (0, import_fields30.text)({
      ui: {
        description: "Contact phone number"
      }
    }),
    email: (0, import_fields30.text)({
      ui: {
        description: "Contact email address"
      }
    }),
    hours: (0, import_fields30.json)({
      defaultValue: {
        monday: { open: "09:00", close: "18:00", closed: false },
        tuesday: { open: "09:00", close: "18:00", closed: false },
        wednesday: { open: "09:00", close: "18:00", closed: false },
        thursday: { open: "09:00", close: "18:00", closed: false },
        friday: { open: "09:00", close: "18:00", closed: false },
        saturday: { open: "09:00", close: "17:00", closed: false },
        sunday: { open: null, close: null, closed: true }
      },
      ui: {
        description: "Business hours by day of week (JSON object with open/close times)"
      }
    }),
    timezone: (0, import_fields30.text)({
      defaultValue: "America/New_York",
      ui: {
        description: "Timezone for this location (e.g., America/New_York)"
      }
    }),
    isActive: (0, import_fields30.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this location is currently active and accepting appointments"
      }
    })
  }
});

// features/keystone/models/Product.ts
var import_core31 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");
var Product = (0, import_core31.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "sku", "price", "quantity", "category", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields31.text)({
      validation: { isRequired: true },
      ui: {
        description: "Product name"
      }
    }),
    sku: (0, import_fields31.text)({
      isIndexed: "unique",
      ui: {
        description: "Stock Keeping Unit - unique product identifier"
      }
    }),
    price: (0, import_fields31.float)({
      validation: { isRequired: true },
      ui: {
        description: "Retail price"
      }
    }),
    cost: (0, import_fields31.float)({
      ui: {
        description: "Wholesale/cost price for profit tracking"
      }
    }),
    quantity: (0, import_fields31.integer)({
      defaultValue: 0,
      ui: {
        description: "Current stock quantity"
      }
    }),
    reorderPoint: (0, import_fields31.integer)({
      defaultValue: 5,
      ui: {
        description: "Minimum quantity before reorder alert"
      }
    }),
    category: (0, import_fields31.text)({
      ui: {
        description: "Product category (e.g., Shampoo, Conditioner, Styling, Color)"
      }
    }),
    description: (0, import_fields31.text)({
      ui: {
        displayMode: "textarea",
        description: "Product description"
      }
    }),
    image: (0, import_fields31.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        inlineCreate: { fields: ["image", "altText"] },
        inlineEdit: { fields: ["image", "altText"] }
      }
    }),
    isActive: (0, import_fields31.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this product is available for sale"
      }
    })
  }
});

// features/keystone/models/ProductSale.ts
var import_core32 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var ProductSale = (0, import_core32.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["soldAt", "total", "soldBy", "appointment"]
    }
  },
  fields: {
    // Optional link to appointment (for retail sales during service)
    appointment: (0, import_fields32.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional - for sales during service visits)"
      }
    }),
    // Products sold in this transaction
    products: (0, import_fields32.json)({
      defaultValue: [],
      ui: {
        description: "Array of products sold: [{ productId, name, quantity, price, subtotal }]"
      }
    }),
    total: (0, import_fields32.float)({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount"
      }
    }),
    // Staff member who made the sale
    soldBy: (0, import_fields32.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the sale"
      }
    }),
    soldAt: (0, import_fields32.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the sale occurred"
      }
    })
  }
});

// features/keystone/models/Commission.ts
var import_core33 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var Commission = (0, import_core33.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["stylist", "payment", "saleAmount", "commissionRate", "commissionAmount", "isPaid"]
    }
  },
  fields: {
    // Commission calculation fields
    saleAmount: (0, import_fields33.float)({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount for this service"
      }
    }),
    commissionRate: (0, import_fields33.float)({
      validation: { isRequired: true, min: 0, max: 1 },
      ui: {
        description: "Commission rate applied (e.g., 0.5 for 50%)"
      }
    }),
    commissionAmount: (0, import_fields33.float)({
      validation: { isRequired: true },
      ui: {
        description: "Calculated commission amount (saleAmount * commissionRate)"
      }
    }),
    // Payment status
    isPaid: (0, import_fields33.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this commission has been paid to the stylist"
      }
    }),
    paidAt: (0, import_fields33.timestamp)({
      ui: {
        description: "When the commission was paid to the stylist"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields33.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the commission was recorded"
      }
    }),
    // Notes
    notes: (0, import_fields33.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes about this commission"
      }
    }),
    // Relationships
    stylist: (0, import_fields33.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Stylist who earned this commission"
      }
    }),
    service: (0, import_fields33.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service that generated this commission"
      }
    }),
    payment: (0, import_fields33.relationship)({
      ref: "Payment",
      ui: {
        displayMode: "select",
        description: "Payment associated with this commission"
      }
    })
  }
});

// features/keystone/models/Review.ts
var import_core34 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var Review = (0, import_core34.list)({
  access: {
    operation: {
      query: () => true,
      // Allow public review viewing
      create: () => true,
      // Allow public review submission
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "rating", "service", "stylist", "isApproved", "createdAt"]
    }
  },
  fields: {
    // Rating (1-5 stars)
    rating: (0, import_fields34.integer)({
      validation: {
        isRequired: true,
        min: 1,
        max: 5
      },
      ui: {
        description: "Rating from 1 to 5 stars"
      }
    }),
    // Review content
    comment: (0, import_fields34.text)({
      ui: {
        displayMode: "textarea",
        description: "Review comment from the client"
      }
    }),
    // Moderation
    isApproved: (0, import_fields34.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this review has been approved to display publicly"
      }
    }),
    // Timestamps
    createdAt: (0, import_fields34.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the review was submitted"
      }
    }),
    // Relationships
    client: (0, import_fields34.relationship)({
      ref: "Client.reviews",
      ui: {
        displayMode: "select",
        description: "Client who wrote this review"
      }
    }),
    service: (0, import_fields34.relationship)({
      ref: "Service.reviews",
      ui: {
        displayMode: "select",
        description: "Service being reviewed"
      }
    }),
    stylist: (0, import_fields34.relationship)({
      ref: "Stylist.reviews",
      ui: {
        displayMode: "select",
        description: "Stylist being reviewed"
      }
    }),
    appointment: (0, import_fields34.relationship)({
      ref: "Appointment.review",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional)"
      }
    })
  }
});

// features/keystone/models/SalonTransaction.ts
var import_core35 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");
var formatCurrency4 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var SalonTransaction = (0, import_core35.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["type", "client", "staff", "total", "paymentStatus", "status"]
    }
  },
  fields: {
    type: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Appointment", value: "appointment" },
        { label: "Walk-in", value: "walk_in" },
        { label: "Retail", value: "retail" }
      ],
      defaultValue: "appointment",
      validation: {
        isRequired: true
      }
    }),
    client: (0, import_fields35.relationship)({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client (optional for walk-ins)"
      }
    }),
    staff: (0, import_fields35.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the transaction"
      }
    }),
    lineItems: (0, import_fields35.relationship)({
      ref: "SalonTransactionLineItem.transaction",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["itemType", "service", "product", "formattedTotal"]
      }
    }),
    tip: (0, import_fields35.integer)({
      defaultValue: 0,
      ui: {
        description: "Tip amount in cents"
      }
    }),
    paymentMethod: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Card", value: "card" },
        { label: "Split", value: "split" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Package", value: "package" }
      ],
      ui: {
        description: "Payment method used"
      }
    }),
    paymentStatus: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Paid", value: "paid" },
        { label: "Partially Paid", value: "partially_paid" },
        { label: "Refunded", value: "refunded" }
      ],
      defaultValue: "pending",
      validation: {
        isRequired: true
      }
    }),
    status: (0, import_fields35.select)({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Completed", value: "completed" },
        { label: "Voided", value: "voided" }
      ],
      defaultValue: "open",
      validation: {
        isRequired: true
      }
    }),
    metadata: (0, import_fields35.json)({
      ui: {
        description: "Additional transaction metadata"
      }
    }),
    completedAt: (0, import_fields35.timestamp)({
      ui: {
        description: "When the transaction was completed"
      }
    }),
    createdAt: (0, import_fields35.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" }
      }
    }),
    ...(0, import_core35.group)({
      label: "Virtual Fields",
      description: "Calculated fields for transaction totals",
      fields: {
        subtotal: (0, import_fields35.virtual)({
          field: import_core35.graphql.field({
            type: import_core35.graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                `
              });
              if (!transaction?.lineItems?.length) return "$0.00";
              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
                subtotal += lineTotal;
              }
              return formatCurrency4(subtotal);
            }
          })
        }),
        tax: (0, import_fields35.virtual)({
          field: import_core35.graphql.field({
            type: import_core35.graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                `
              });
              if (!transaction?.lineItems?.length) return "$0.00";
              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
                subtotal += lineTotal;
              }
              const tax = subtotal * 0.08;
              return formatCurrency4(tax);
            }
          })
        }),
        discount: (0, import_fields35.virtual)({
          field: import_core35.graphql.field({
            type: import_core35.graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    discount
                  }
                `
              });
              if (!transaction?.lineItems?.length) return "$0.00";
              const totalDiscount = transaction.lineItems.reduce(
                (sum, item2) => sum + (item2.discount || 0),
                0
              );
              if (totalDiscount === 0) return "$0.00";
              return formatCurrency4(totalDiscount);
            }
          })
        }),
        total: (0, import_fields35.virtual)({
          field: import_core35.graphql.field({
            type: import_core35.graphql.String,
            async resolve(item, args, context) {
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: item.id },
                query: `
                  lineItems {
                    quantity
                    unitPrice
                    discount
                  }
                  tip
                `
              });
              if (!transaction?.lineItems?.length) return "$0.00";
              let subtotal = 0;
              for (const lineItem of transaction.lineItems) {
                const lineTotal = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
                subtotal += lineTotal;
              }
              const tax = subtotal * 0.08;
              const total = subtotal + tax + (transaction.tip || 0);
              return formatCurrency4(total);
            }
          })
        })
      }
    })
  }
});

// features/keystone/models/SalonTransactionLineItem.ts
var import_core36 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
var formatCurrency5 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var SalonTransactionLineItem = (0, import_core36.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["transaction", "itemType", "service", "product", "staff", "formattedTotal"]
    }
  },
  fields: {
    transaction: (0, import_fields36.relationship)({
      ref: "SalonTransaction.lineItems",
      ui: {
        displayMode: "select",
        description: "Related transaction"
      }
    }),
    itemType: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Product", value: "product" }
      ],
      validation: {
        isRequired: true
      }
    }),
    service: (0, import_fields36.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service (if itemType is service)"
      }
    }),
    product: (0, import_fields36.relationship)({
      ref: "Product",
      ui: {
        displayMode: "select",
        description: "Product (if itemType is product)"
      }
    }),
    staff: (0, import_fields36.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who provided the service"
      }
    }),
    quantity: (0, import_fields36.integer)({
      defaultValue: 1,
      validation: {
        isRequired: true
      }
    }),
    unitPrice: (0, import_fields36.integer)({
      validation: {
        isRequired: true
      },
      ui: {
        description: "Price per unit in cents"
      }
    }),
    discount: (0, import_fields36.integer)({
      defaultValue: 0,
      ui: {
        description: "Discount amount in cents"
      }
    }),
    commissionRate: (0, import_fields36.float)({
      ui: {
        description: "Commission rate for staff (percentage)"
      }
    }),
    metadata: (0, import_fields36.json)({
      ui: {
        description: "Additional line item metadata"
      }
    }),
    formattedPrice: (0, import_fields36.virtual)({
      field: import_core36.graphql.field({
        type: import_core36.graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: item.id },
            query: "unitPrice"
          });
          if (!lineItem?.unitPrice) return "$0.00";
          return formatCurrency5(lineItem.unitPrice);
        }
      })
    }),
    formattedTotal: (0, import_fields36.virtual)({
      field: import_core36.graphql.field({
        type: import_core36.graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: item.id },
            query: "unitPrice quantity discount"
          });
          if (!lineItem?.unitPrice || !lineItem?.quantity) return "$0.00";
          const total = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
          return formatCurrency5(total);
        }
      })
    }),
    commissionAmount: (0, import_fields36.virtual)({
      field: import_core36.graphql.field({
        type: import_core36.graphql.String,
        async resolve(item, args, context) {
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: item.id },
            query: "unitPrice quantity discount commissionRate"
          });
          if (!lineItem?.unitPrice || !lineItem?.quantity || !lineItem?.commissionRate) {
            return "$0.00";
          }
          const total = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
          const commission = total * (lineItem.commissionRate / 100);
          return formatCurrency5(commission);
        }
      })
    })
  }
});

// features/keystone/models/ClientPackage.ts
var import_core37 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var formatCurrency6 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var ClientPackage = (0, import_core37.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "package", "status", "purchasedAt", "expiresAt"]
    }
  },
  fields: {
    client: (0, import_fields37.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Client who purchased the package"
      }
    }),
    package: (0, import_fields37.relationship)({
      ref: "ServicePackage",
      ui: {
        displayMode: "select",
        description: "The service package purchased"
      }
    }),
    purchasedAt: (0, import_fields37.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the package was purchased"
      }
    }),
    expiresAt: (0, import_fields37.timestamp)({
      ui: {
        description: "When the package expires (calculated from validityDays)"
      }
    }),
    status: (0, import_fields37.select)({
      type: "string",
      defaultValue: "active",
      options: [
        { label: "Active", value: "active" },
        { label: "Expired", value: "expired" },
        { label: "Fully Used", value: "fully-used" },
        { label: "Cancelled", value: "cancelled" }
      ],
      ui: {
        displayMode: "select",
        description: "Current status of the package"
      }
    }),
    totalValue: (0, import_fields37.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Total package value in cents"
      }
    }),
    paidAmount: (0, import_fields37.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Amount paid in cents"
      }
    }),
    usedValue: (0, import_fields37.integer)({
      defaultValue: 0,
      ui: {
        description: "Amount used so far in cents"
      }
    }),
    usageHistory: (0, import_fields37.relationship)({
      ref: "ClientPackageUsage.clientPackage",
      many: true,
      ui: {
        displayMode: "count",
        description: "Usage history of this package"
      }
    }),
    metadata: (0, import_fields37.json)({
      ui: {
        description: "Additional metadata"
      }
    }),
    remainingValue: (0, import_fields37.virtual)({
      field: import_core37.graphql.field({
        type: import_core37.graphql.Int,
        async resolve(item, args, context) {
          const pkg = await context.sudo().query.ClientPackage.findOne({
            where: { id: item.id },
            query: "totalValue usedValue"
          });
          if (!pkg) return 0;
          return (pkg.totalValue || 0) - (pkg.usedValue || 0);
        }
      })
    }),
    formattedRemainingValue: (0, import_fields37.virtual)({
      field: import_core37.graphql.field({
        type: import_core37.graphql.String,
        async resolve(item, args, context) {
          const pkg = await context.sudo().query.ClientPackage.findOne({
            where: { id: item.id },
            query: "totalValue usedValue"
          });
          if (!pkg) return "$0.00";
          const remaining = (pkg.totalValue || 0) - (pkg.usedValue || 0);
          return formatCurrency6(remaining);
        }
      })
    })
  }
});

// features/keystone/models/ClientPackageUsage.ts
var import_core38 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var formatCurrency7 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var ClientPackageUsage = (0, import_core38.list)({
  access: {
    operation: {
      query: () => true,
      create: isSignedIn,
      update: isSignedIn,
      delete: isSignedIn
    }
  },
  ui: {
    listView: {
      initialColumns: ["clientPackage", "service", "quantityUsed", "valueUsed", "usedAt"]
    }
  },
  fields: {
    clientPackage: (0, import_fields38.relationship)({
      ref: "ClientPackage.usageHistory",
      ui: {
        displayMode: "select",
        description: "The client package this usage is for"
      }
    }),
    appointment: (0, import_fields38.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "The appointment where this was used"
      }
    }),
    service: (0, import_fields38.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "The service that was used"
      }
    }),
    quantityUsed: (0, import_fields38.integer)({
      defaultValue: 1,
      validation: { min: 1 },
      ui: {
        description: "Number of units used"
      }
    }),
    valueUsed: (0, import_fields38.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Value used in cents"
      }
    }),
    usedAt: (0, import_fields38.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the package was used"
      }
    }),
    formattedValueUsed: (0, import_fields38.virtual)({
      field: import_core38.graphql.field({
        type: import_core38.graphql.String,
        async resolve(item, args, context) {
          const usage = await context.sudo().query.ClientPackageUsage.findOne({
            where: { id: item.id },
            query: "valueUsed"
          });
          if (!usage?.valueUsed) return "$0.00";
          return formatCurrency7(usage.valueUsed);
        }
      })
    })
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  SalonImage,
  ServiceCategory,
  Service,
  ServiceVariant,
  Stylist,
  Client,
  ClientNote,
  ColorFormula,
  StylistSchedule,
  Appointment,
  AppointmentLineItem,
  Payment,
  ClientPoints,
  Referral,
  MessageTemplate,
  MessageLog,
  GiftCard,
  GiftCardTransaction,
  ClientMembership,
  IntakeForm,
  ServicePackage,
  Membership,
  WaitlistEntry,
  WidgetConfiguration,
  FormSubmission,
  FormTemplate,
  LoyaltyProgram,
  Location,
  Product,
  ProductSale,
  Commission,
  Review,
  SalonTransaction,
  SalonTransactionLineItem,
  ClientPackage,
  ClientPackageUsage
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_core41 = require("@keystone-6/core");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/processPayment.ts
var import_core39 = require("@keystone-6/core");
var STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
var stripe = null;
if (STRIPE_SECRET_KEY) {
  import("stripe").then((Stripe) => {
    stripe = new Stripe.default(STRIPE_SECRET_KEY);
  }).catch(() => {
    console.warn("Stripe module not installed. Payment processing disabled.");
  });
}
var TAX_RATE = parseFloat(process.env.TAX_RATE || "0.08");
var processPayment = import_core39.graphql.field({
  type: import_core39.graphql.object()({
    name: "ProcessPaymentResult",
    fields: {
      success: import_core39.graphql.field({ type: import_core39.graphql.nonNull(import_core39.graphql.Boolean) }),
      paymentId: import_core39.graphql.field({ type: import_core39.graphql.String }),
      error: import_core39.graphql.field({ type: import_core39.graphql.String }),
      clientSecret: import_core39.graphql.field({ type: import_core39.graphql.String })
    }
  }),
  args: {
    appointmentId: import_core39.graphql.arg({ type: import_core39.graphql.nonNull(import_core39.graphql.ID) }),
    paymentMethod: import_core39.graphql.arg({ type: import_core39.graphql.nonNull(import_core39.graphql.String) }),
    tipAmount: import_core39.graphql.arg({ type: import_core39.graphql.Float }),
    discountAmount: import_core39.graphql.arg({ type: import_core39.graphql.Float })
  },
  async resolve(source, { appointmentId, paymentMethod, tipAmount, discountAmount }, context) {
    if (!context.session) {
      return {
        success: false,
        paymentId: null,
        error: "You must be logged in to process payments",
        clientSecret: null
      };
    }
    try {
      const appointment = await context.db.Appointment.findOne({
        where: { id: appointmentId }
      });
      if (!appointment) {
        return {
          success: false,
          paymentId: null,
          error: "Appointment not found",
          clientSecret: null
        };
      }
      const appointmentWithServices = await context.query.Appointment.findOne({
        where: { id: appointmentId },
        query: `
          services {
            id
            basePrice
          }
          stylist {
            id
            tier
          }
          client {
            user {
              email
            }
          }
        `
      });
      if (!appointmentWithServices?.services?.length) {
        return {
          success: false,
          paymentId: null,
          error: "No services found for this appointment",
          clientSecret: null
        };
      }
      const subtotal = appointmentWithServices.services.reduce(
        (sum, service) => sum + (service.basePrice || 0),
        0
      );
      const tax = subtotal * TAX_RATE;
      const tip = tipAmount || 0;
      const discount = discountAmount || 0;
      const totalAmount = subtotal + tax + tip - discount;
      const clientEmail = appointmentWithServices.client?.user?.email;
      const payment = await context.db.Payment.createOne({
        data: {
          subtotal,
          tax,
          tip,
          discount,
          totalAmount,
          paymentMethod,
          status: paymentMethod === "cash" ? "completed" : "pending",
          appointment: { connect: { id: appointmentId } },
          processedBy: { connect: { id: context.session.itemId } },
          processedAt: paymentMethod === "cash" ? /* @__PURE__ */ new Date() : null,
          receiptEmail: clientEmail || ""
        }
      });
      if (paymentMethod !== "cash" && stripe) {
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100),
            // Stripe uses cents
            currency: "usd",
            metadata: {
              appointmentId,
              paymentId: payment.id
            }
          });
          await context.db.Payment.updateOne({
            where: { id: payment.id },
            data: {
              stripePaymentIntentId: paymentIntent.id,
              status: "processing"
            }
          });
          return {
            success: true,
            paymentId: payment.id,
            error: null,
            clientSecret: paymentIntent.client_secret
          };
        } catch (stripeError) {
          await context.db.Payment.updateOne({
            where: { id: payment.id },
            data: { status: "failed" }
          });
          return {
            success: false,
            paymentId: payment.id,
            error: `Stripe error: ${stripeError.message}`,
            clientSecret: null
          };
        }
      }
      await context.db.Appointment.updateOne({
        where: { id: appointmentId },
        data: { status: "completed" }
      });
      return {
        success: true,
        paymentId: payment.id,
        error: null,
        clientSecret: null
      };
    } catch (error) {
      return {
        success: false,
        paymentId: null,
        error: error.message,
        clientSecret: null
      };
    }
  }
});
var confirmPayment = import_core39.graphql.field({
  type: import_core39.graphql.object()({
    name: "ConfirmPaymentResult",
    fields: {
      success: import_core39.graphql.field({ type: import_core39.graphql.nonNull(import_core39.graphql.Boolean) }),
      error: import_core39.graphql.field({ type: import_core39.graphql.String })
    }
  }),
  args: {
    paymentId: import_core39.graphql.arg({ type: import_core39.graphql.nonNull(import_core39.graphql.ID) }),
    stripePaymentIntentId: import_core39.graphql.arg({ type: import_core39.graphql.String })
  },
  async resolve(source, { paymentId, stripePaymentIntentId }, context) {
    if (!context.session) {
      return {
        success: false,
        error: "You must be logged in"
      };
    }
    try {
      const payment = await context.db.Payment.findOne({
        where: { id: paymentId }
      });
      if (!payment) {
        return {
          success: false,
          error: "Payment not found"
        };
      }
      if (stripePaymentIntentId && stripe) {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
        if (paymentIntent.status !== "succeeded") {
          return {
            success: false,
            error: `Payment not completed. Status: ${paymentIntent.status}`
          };
        }
        const charge = paymentIntent.latest_charge ? await stripe.charges.retrieve(paymentIntent.latest_charge) : null;
        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: "completed",
            stripeChargeId: charge?.id || "",
            cardBrand: charge?.payment_method_details?.card?.brand || "",
            cardLast4: charge?.payment_method_details?.card?.last4 || "",
            processedAt: /* @__PURE__ */ new Date()
          }
        });
      } else {
        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: "completed",
            processedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      const updatedPayment = await context.query.Payment.findOne({
        where: { id: paymentId },
        query: `appointment { id }`
      });
      if (updatedPayment?.appointment?.id) {
        await context.db.Appointment.updateOne({
          where: { id: updatedPayment.appointment.id },
          data: { status: "completed" }
        });
      }
      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
var refundPayment = import_core39.graphql.field({
  type: import_core39.graphql.object()({
    name: "RefundPaymentResult",
    fields: {
      success: import_core39.graphql.field({ type: import_core39.graphql.nonNull(import_core39.graphql.Boolean) }),
      refundId: import_core39.graphql.field({ type: import_core39.graphql.String }),
      error: import_core39.graphql.field({ type: import_core39.graphql.String })
    }
  }),
  args: {
    paymentId: import_core39.graphql.arg({ type: import_core39.graphql.nonNull(import_core39.graphql.ID) }),
    amount: import_core39.graphql.arg({ type: import_core39.graphql.Float }),
    reason: import_core39.graphql.arg({ type: import_core39.graphql.String })
  },
  async resolve(source, { paymentId, amount, reason }, context) {
    if (!context.session) {
      return {
        success: false,
        refundId: null,
        error: "You must be logged in"
      };
    }
    try {
      const payment = await context.db.Payment.findOne({
        where: { id: paymentId }
      });
      if (!payment) {
        return {
          success: false,
          refundId: null,
          error: "Payment not found"
        };
      }
      if (payment.status !== "completed") {
        return {
          success: false,
          refundId: null,
          error: "Can only refund completed payments"
        };
      }
      const refundAmount = amount || payment.totalAmount;
      if (payment.stripeChargeId && stripe) {
        const refund = await stripe.refunds.create({
          charge: payment.stripeChargeId,
          amount: Math.round(refundAmount * 100),
          reason: reason ? "requested_by_customer" : void 0
        });
        await context.db.Payment.updateOne({
          where: { id: paymentId },
          data: {
            status: refundAmount >= payment.totalAmount ? "refunded" : "partially_refunded",
            stripeRefundId: refund.id,
            refundedAmount: refundAmount,
            refundReason: reason || "",
            refundedAt: /* @__PURE__ */ new Date()
          }
        });
        return {
          success: true,
          refundId: refund.id,
          error: null
        };
      }
      await context.db.Payment.updateOne({
        where: { id: paymentId },
        data: {
          status: refundAmount >= payment.totalAmount ? "refunded" : "partially_refunded",
          refundedAmount: refundAmount,
          refundReason: reason || "",
          refundedAt: /* @__PURE__ */ new Date()
        }
      });
      return {
        success: true,
        refundId: null,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        refundId: null,
        error: error.message
      };
    }
  }
});
var distributeTip = import_core39.graphql.field({
  type: import_core39.graphql.object()({
    name: "DistributeTipResult",
    fields: {
      success: import_core39.graphql.field({ type: import_core39.graphql.nonNull(import_core39.graphql.Boolean) }),
      error: import_core39.graphql.field({ type: import_core39.graphql.String })
    }
  }),
  args: {
    paymentId: import_core39.graphql.arg({ type: import_core39.graphql.nonNull(import_core39.graphql.ID) })
  },
  async resolve(source, { paymentId }, context) {
    if (!context.session) {
      return {
        success: false,
        error: "You must be logged in"
      };
    }
    try {
      const payment = await context.query.Payment.findOne({
        where: { id: paymentId },
        query: `
          id
          tip
          tipDistributed
          appointment {
            stylist {
              id
              commissionRate
            }
          }
        `
      });
      if (!payment) {
        return {
          success: false,
          error: "Payment not found"
        };
      }
      if (payment.tipDistributed) {
        return {
          success: false,
          error: "Tip already distributed"
        };
      }
      if (!payment.tip || payment.tip <= 0) {
        return {
          success: false,
          error: "No tip to distribute"
        };
      }
      await context.db.Payment.updateOne({
        where: { id: paymentId },
        data: {
          tipDistributed: true,
          notes: `Tip of $${payment.tip.toFixed(2)} distributed to stylist`
        }
      });
      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
});
var paymentMutations = {
  processPayment,
  confirmPayment,
  refundPayment,
  distributeTip
};

// features/keystone/mutations/purchaseGiftCard.ts
var import_core40 = require("@keystone-6/core");

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}
function giftCardEmail(params) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const primaryColor = "#8b5cf6";
  return `
    <body style="background: ${backgroundColor}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: ${backgroundColor}; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background: ${mainBackgroundColor}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, ${primaryColor}, #a78bfa); border-radius: 12px 12px 0 0;">
                  <h1 style="margin: 0; font-size: 32px; color: #ffffff; font-weight: bold;">You've Received a Gift Card!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 18px; color: #f3e8ff;">From ${params.senderName}</p>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 40px 20px 40px;">
                  <p style="margin: 0; font-size: 16px; color: ${textColor}; line-height: 1.6;">
                    Hi ${params.recipientName},
                  </p>
                  ${params.message ? `
                    <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-left: 4px solid ${primaryColor}; border-radius: 4px;">
                      <p style="margin: 0; font-size: 15px; color: ${textColor}; font-style: italic; line-height: 1.6;">
                        "${params.message}"
                      </p>
                    </div>
                  ` : ""}
                </td>
              </tr>

              <!-- Gift Card Amount -->
              <tr>
                <td style="padding: 20px 40px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius: 8px; border: 2px solid ${primaryColor};">
                    <tr>
                      <td style="padding: 30px; text-align: center;">
                        <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Gift Card Value</p>
                        <p style="margin: 10px 0 20px 0; font-size: 48px; color: ${primaryColor}; font-weight: bold;">$${params.amount.toFixed(2)}</p>
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Gift Card Code</p>
                        <p style="margin: 10px 0 0 0; font-size: 24px; color: ${textColor}; font-weight: bold; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                          ${params.code}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Redemption Instructions -->
              <tr>
                <td style="padding: 20px 40px 40px 40px;">
                  <h3 style="margin: 0 0 15px 0; font-size: 18px; color: ${textColor};">How to Use Your Gift Card</h3>
                  <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: ${textColor}; line-height: 1.8;">
                    <li>Book an appointment online or call us</li>
                    <li>Provide your gift card code during checkout</li>
                    <li>Enjoy your salon experience!</li>
                  </ol>
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="${process.env.SMTP_STORE_LINK}/book" style="display: inline-block; padding: 15px 30px; background: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Book Your Appointment
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6;">
                    This gift card never expires and can be used for any service.<br/>
                    Questions? Contact us at ${process.env.SMTP_FROM}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendGiftCardEmail(params) {
  try {
    const info = await transport.sendMail({
      to: params.to,
      from: process.env.SMTP_FROM,
      subject: `You've Received a $${params.amount} Gift Card from ${params.senderName}!`,
      html: giftCardEmail(params)
    });
    if (process.env.SMTP_USER?.includes("ethereal.email")) {
      console.log(`\u{1F4E7} Gift card email sent! Preview: ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
    }
  } catch (error) {
    console.error("Failed to send gift card email:", error);
    throw error;
  }
}

// features/keystone/mutations/purchaseGiftCard.ts
var STRIPE_SECRET_KEY2 = process.env.STRIPE_SECRET_KEY;
var stripe2 = null;
if (STRIPE_SECRET_KEY2) {
  import("stripe").then((Stripe) => {
    stripe2 = new Stripe.default(STRIPE_SECRET_KEY2);
  }).catch(() => {
    console.warn("Stripe module not installed. Gift card processing disabled.");
  });
}
function generateGiftCardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
var purchaseGiftCard = import_core40.graphql.field({
  type: import_core40.graphql.object()({
    name: "PurchaseGiftCardResult",
    fields: {
      success: import_core40.graphql.field({ type: import_core40.graphql.nonNull(import_core40.graphql.Boolean) }),
      giftCardId: import_core40.graphql.field({ type: import_core40.graphql.String }),
      clientSecret: import_core40.graphql.field({ type: import_core40.graphql.String }),
      error: import_core40.graphql.field({ type: import_core40.graphql.String })
    }
  }),
  args: {
    amount: import_core40.graphql.arg({ type: import_core40.graphql.nonNull(import_core40.graphql.Float) }),
    recipientEmail: import_core40.graphql.arg({ type: import_core40.graphql.String }),
    recipientName: import_core40.graphql.arg({ type: import_core40.graphql.String }),
    message: import_core40.graphql.arg({ type: import_core40.graphql.String }),
    purchaserEmail: import_core40.graphql.arg({ type: import_core40.graphql.nonNull(import_core40.graphql.String) }),
    purchaserName: import_core40.graphql.arg({ type: import_core40.graphql.nonNull(import_core40.graphql.String) })
  },
  async resolve(source, { amount, recipientEmail, recipientName, message, purchaserEmail, purchaserName }, context) {
    try {
      if (amount < 25 || amount > 500) {
        return {
          success: false,
          giftCardId: null,
          clientSecret: null,
          error: "Gift card amount must be between $25 and $500"
        };
      }
      const code = generateGiftCardCode();
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      if (!stripe2) {
        return {
          success: false,
          giftCardId: null,
          clientSecret: null,
          error: "Payment processing is not available. Please contact support."
        };
      }
      const paymentIntent = await stripe2.paymentIntents.create({
        amount: Math.round(amount * 100),
        // Stripe uses cents
        currency: "usd",
        metadata: {
          type: "gift_card",
          code,
          purchaserEmail,
          recipientEmail: recipientEmail || purchaserEmail
        },
        receipt_email: purchaserEmail
      });
      const giftCard = await context.db.GiftCard.createOne({
        data: {
          code,
          initialValue: amount,
          currentBalance: amount,
          recipientEmail: recipientEmail || purchaserEmail,
          recipientName: recipientName || purchaserName,
          message: message || "",
          expiresAt,
          isActive: false
          // Will be activated when payment is confirmed
        }
      });
      await context.db.GiftCardTransaction.createOne({
        data: {
          giftCard: { connect: { id: giftCard.id } },
          type: "purchase",
          amount
        }
      });
      return {
        success: true,
        giftCardId: giftCard.id,
        clientSecret: paymentIntent.client_secret,
        error: null
      };
    } catch (error) {
      console.error("Gift card purchase error:", error);
      return {
        success: false,
        giftCardId: null,
        clientSecret: null,
        error: error.message || "Failed to process gift card purchase"
      };
    }
  }
});
var confirmGiftCardPurchase = import_core40.graphql.field({
  type: import_core40.graphql.object()({
    name: "ConfirmGiftCardPurchaseResult",
    fields: {
      success: import_core40.graphql.field({ type: import_core40.graphql.nonNull(import_core40.graphql.Boolean) }),
      error: import_core40.graphql.field({ type: import_core40.graphql.String }),
      code: import_core40.graphql.field({ type: import_core40.graphql.String })
    }
  }),
  args: {
    giftCardId: import_core40.graphql.arg({ type: import_core40.graphql.nonNull(import_core40.graphql.ID) }),
    stripePaymentIntentId: import_core40.graphql.arg({ type: import_core40.graphql.nonNull(import_core40.graphql.String) })
  },
  async resolve(source, { giftCardId, stripePaymentIntentId }, context) {
    try {
      if (!stripe2) {
        return {
          success: false,
          error: "Payment verification not available",
          code: null
        };
      }
      const paymentIntent = await stripe2.paymentIntents.retrieve(stripePaymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return {
          success: false,
          error: `Payment not completed. Status: ${paymentIntent.status}`,
          code: null
        };
      }
      const giftCard = await context.query.GiftCard.findOne({
        where: { id: giftCardId },
        query: `
          id
          code
          initialValue
          recipientEmail
          recipientName
        `
      });
      if (!giftCard) {
        return {
          success: false,
          error: "Gift card not found",
          code: null
        };
      }
      await context.db.GiftCard.updateOne({
        where: { id: giftCardId },
        data: {
          isActive: true
        }
      });
      try {
        const purchaserName = paymentIntent.metadata.purchaserEmail || "A friend";
        await sendGiftCardEmail({
          to: giftCard.recipientEmail || "",
          recipientName: giftCard.recipientName || "There",
          senderName: purchaserName,
          amount: giftCard.initialValue,
          code: giftCard.code || "",
          message: void 0
          // Could be added to metadata
        });
      } catch (emailError) {
        console.error("Failed to send gift card email:", emailError);
      }
      return {
        success: true,
        error: null,
        code: giftCard.code
      };
    } catch (error) {
      console.error("Gift card confirmation error:", error);
      return {
        success: false,
        error: error.message || "Failed to confirm gift card purchase",
        code: null
      };
    }
  }
});
var giftCardMutations = {
  purchaseGiftCard,
  confirmGiftCardPurchase
};

// features/keystone/mutations/index.ts
var gql = String.raw;
var extendGraphqlSchema = import_core41.graphql.extend((base) => ({
  query: {
    redirectToInit: import_core41.graphql.field({
      type: import_core41.graphql.Boolean,
      resolve: redirectToInit_default
    })
  },
  mutation: {
    processPayment: paymentMutations.processPayment,
    confirmPayment: paymentMutations.confirmPayment,
    refundPayment: paymentMutations.refundPayment,
    distributeTip: paymentMutations.distributeTip,
    purchaseGiftCard: giftCardMutations.purchaseGiftCard,
    confirmGiftCardPurchase: giftCardMutations.confirmGiftCardPurchase
  }
}));

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  // How long they stay signed in?
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com"
} = process.env;
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
          canCreateTodos: true,
          canManageAllTodos: true,
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    role {
      id
      name
      canCreateTodos
      canManageAllTodos
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
    }
  `
});
var keystone_default = withAuth(
  (0, import_core42.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session })
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
