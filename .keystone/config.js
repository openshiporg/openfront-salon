"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  manualPaymentAdapter: () => manualPaymentAdapter
});
var reference, manualPaymentAdapter;
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
    reference = (idempotencyKey) => `manual_${idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    manualPaymentAdapter = {
      async createSession({ amount, currency, idempotencyKey }) {
        return {
          status: "pending",
          providerReference: reference(idempotencyKey),
          clientSecret: null,
          data: { amount, currency: currency.toLowerCase() }
        };
      },
      async confirm({ providerReference, amount }) {
        return {
          status: "completed",
          providerReference,
          amount,
          data: { completedAt: (/* @__PURE__ */ new Date()).toISOString() }
        };
      },
      async refund({ providerReference, amount }) {
        return {
          status: "refunded",
          providerReference,
          amount,
          data: { refundedAt: (/* @__PURE__ */ new Date()).toISOString() }
        };
      },
      async parseWebhook() {
        return { isValid: false, eventId: "unsupported", type: "unsupported", providerReference: null, status: null };
      }
    };
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  stripePaymentAdapter: () => stripePaymentAdapter
});
function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured");
  return new import_stripe.default(secretKey);
}
function mapStatus(status) {
  if (status === "succeeded") return "completed";
  if (status === "requires_action" || status === "requires_payment_method" || status === "requires_confirmation") return "requires_action";
  if (status === "processing") return "authorized";
  if (status === "canceled") return "cancelled";
  return "pending";
}
var import_stripe, stripePaymentAdapter;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    import_stripe = __toESM(require("stripe"));
    stripePaymentAdapter = {
      async createSession({ amount, currency, idempotencyKey, metadata }) {
        const intent = await stripeClient().paymentIntents.create(
          {
            amount,
            currency: currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            metadata
          },
          { idempotencyKey }
        );
        return {
          status: mapStatus(intent.status),
          providerReference: intent.id,
          clientSecret: intent.client_secret,
          data: { status: intent.status }
        };
      },
      async confirm({ providerReference }) {
        const intent = await stripeClient().paymentIntents.retrieve(providerReference);
        return {
          status: mapStatus(intent.status),
          providerReference,
          amount: intent.amount_received,
          data: { status: intent.status }
        };
      },
      async refund({ providerReference, amount, idempotencyKey, refundId }) {
        const refund = refundId ? await stripeClient().refunds.retrieve(refundId) : await stripeClient().refunds.create(
          { payment_intent: providerReference, ...amount ? { amount } : {} },
          { idempotencyKey }
        );
        return {
          status: refund.status === "succeeded" ? "refunded" : ["failed", "canceled"].includes(refund.status || "") ? "failed" : "pending",
          providerReference,
          amount: refund.amount,
          data: { refundId: refund.id, status: refund.status }
        };
      },
      async parseWebhook({ payload, headers }) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const signature = headers["stripe-signature"];
        if (!secret || !signature) throw new Error("Stripe webhook verification is not configured");
        const event = stripeClient().webhooks.constructEvent(payload, signature, secret);
        const resource = event.data.object;
        const paymentIntent = "payment_intent" in resource ? resource.payment_intent : null;
        const providerReference = paymentIntent ? typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id : resource.object === "payment_intent" ? resource.id : null;
        let amount = resource.object === "payment_intent" ? resource.amount_received || resource.amount : resource.object === "charge" ? resource.amount_refunded : resource.amount;
        let status = event.type === "payment_intent.succeeded" ? "completed" : event.type === "payment_intent.payment_failed" ? "requires_action" : event.type === "payment_intent.canceled" ? "cancelled" : event.type === "charge.refunded" ? "refunded" : null;
        if (event.type === "refund.updated" && resource.object === "refund" && resource.status === "succeeded") {
          const chargeId = typeof resource.charge === "string" ? resource.charge : resource.charge?.id;
          if (chargeId) {
            const charge = await stripeClient().charges.retrieve(chargeId);
            amount = charge.amount_refunded;
            status = "refunded";
          }
        }
        return {
          isValid: true,
          eventId: event.id,
          type: event.type,
          providerReference,
          status,
          amount,
          currency: resource.currency,
          data: { livemode: event.livemode }
        };
      }
    };
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core85 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access2 = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
function rolePermission(session, permission) {
  return session?.data.role?.canManageSalon === true || session?.data.role?.[permission] === true;
}
var permissions = {
  canCreateTodos: ({ session }) => session?.data.role?.canCreateTodos ?? false,
  canManageAllTodos: ({ session }) => session?.data.role?.canManageAllTodos ?? false,
  canManagePeople: ({ session }) => session?.data.role?.canManagePeople === true,
  canManageRoles: ({ session }) => session?.data.role?.canManageRoles === true,
  canAccessDashboard: ({ session }) => session?.data.role?.canAccessDashboard === true,
  // Onboarding remains explicit even for managers so production seed access can be revoked independently.
  canManageOnboarding: ({ session }) => session?.data.role?.canManageOnboarding === true,
  canManageSalon: ({ session }) => session?.data.role?.canManageSalon === true,
  canManageAppointments: ({ session }) => rolePermission(session, "canManageAppointments"),
  canManageClients: ({ session }) => rolePermission(session, "canManageClients"),
  // Consultation answers are purpose-restricted care data. Manager status alone
  // does not grant access; the role must carry this explicit authority.
  canManageCareRecords: ({ session }) => session?.data.role?.canManageCareRecords === true,
  canManageCatalog: ({ session }) => rolePermission(session, "canManageCatalog"),
  canManageSchedules: ({ session }) => rolePermission(session, "canManageSchedules"),
  canManageOwnSchedule: ({ session }) => rolePermission(session, "canManageOwnSchedule"),
  canManageResources: ({ session }) => rolePermission(session, "canManageResources"),
  canManageInventory: ({ session }) => rolePermission(session, "canManageInventory"),
  canManagePayments: ({ session }) => rolePermission(session, "canManagePayments"),
  canIssueRefunds: ({ session }) => rolePermission(session, "canIssueRefunds"),
  canManageCommissions: ({ session }) => rolePermission(session, "canManageCommissions"),
  canViewReports: ({ session }) => rolePermission(session, "canViewReports"),
  canManageIntegrations: ({ session }) => rolePermission(session, "canManageIntegrations")
};
function ownerId(session) {
  return session?.itemId;
}
function anyPermission(session, checks) {
  return checks.some((check) => check({ session }));
}
var rules = {
  canReadTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) return { OR: [{ assignedTo: { id: { equals: session.itemId } } }, { assignedTo: null, isPrivate: { equals: true } }, { NOT: { isPrivate: { equals: true } } }] };
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canManageTodos: ({ session }) => {
    if (!session) return false;
    if (session.data.role?.canManageAllTodos) return true;
    return { assignedTo: { id: { equals: session.itemId } } };
  },
  canReadPeople: ({ session }) => {
    if (!session) return false;
    if (permissions.canManagePeople({ session }) || session.data.role?.canSeeOtherPeople) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople: ({ session }) => {
    if (!session) return false;
    if (permissions.canManagePeople({ session }) || session.data.role?.canEditOtherPeople) return true;
    return { id: { equals: session.itemId } };
  },
  canReadClients: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManageAppointments])) return true;
    return { user: { id: { equals: ownerId(session) } } };
  },
  canReadAppointments: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageAppointments, permissions.canManagePayments, permissions.canIssueRefunds])) return true;
    return { client: { user: { id: { equals: ownerId(session) } } } };
  },
  canReadAppointmentLineItems: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageAppointments, permissions.canManagePayments])) return true;
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadPayments: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManagePayments, permissions.canIssueRefunds, permissions.canViewReports])) return true;
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadSalonTransactions: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManagePayments, permissions.canViewReports])) return true;
    return { client: { user: { id: { equals: ownerId(session) } } } };
  },
  canReadSalonTransactionLineItems: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManagePayments, permissions.canViewReports])) return true;
    return { transaction: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadFormSubmissions: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageCareRecords({ session })) return true;
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadClientPackages: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true;
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadClientPackageUsages: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true;
    return { clientPackage: { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } };
  },
  canReadClientMemberships: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true;
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadGiftCards: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true;
    return { purchasedBy: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadGiftCardTransactions: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments])) return true;
    return { giftCard: { purchasedBy: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } };
  },
  canReadClientPoints: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageClients({ session })) return true;
    return { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadReferrals: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageClients({ session })) return true;
    return { OR: [{ referrer: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }, { referred: { clientProfile: { user: { id: { equals: ownerId(session) } } } } }] };
  },
  canReadMessageLogs: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageClients({ session })) return true;
    return { recipient: { clientProfile: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadProductSales: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageInventory, permissions.canViewReports])) return true;
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadCommissions: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageCommissions({ session })) return true;
    return { stylist: { user: { id: { equals: ownerId(session) } } } };
  },
  canReadAppointmentSegments: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageAppointments({ session })) return true;
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadAppointmentScheduleRevisions: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageAppointments({ session })) return true;
    return { appointment: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadSegmentTransitions: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageAppointments({ session })) return true;
    return { segment: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } };
  },
  canReadTransactionReversals: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canIssueRefunds, permissions.canManagePayments, permissions.canViewReports])) return true;
    return { transaction: { client: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadTransactionReversalLines: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canIssueRefunds, permissions.canManagePayments, permissions.canViewReports])) return true;
    return { reversal: { transaction: { client: { user: { id: { equals: ownerId(session) } } } } } };
  },
  canReadCommissionAdjustments: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageCommissions({ session }) || permissions.canViewReports({ session })) return true;
    return { commission: { stylist: { user: { id: { equals: ownerId(session) } } } } };
  },
  canReadGratuityEntries: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManagePayments, permissions.canManageCommissions, permissions.canViewReports])) return true;
    return { OR: [
      { practitioner: { user: { id: { equals: ownerId(session) } } } },
      { payment: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } }
    ] };
  },
  canReadConsultationSubmissions: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageCareRecords({ session })) return true;
    return { client: { id: { equals: ownerId(session) } } };
  },
  canReadConsultationReviews: ({ session }) => {
    if (!session) return false;
    if (permissions.canManageCareRecords({ session })) return true;
    return { submission: { client: { id: { equals: ownerId(session) } } } };
  },
  canReadClientPackageAdjustments: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManageClients, permissions.canManagePayments, permissions.canIssueRefunds])) return true;
    return { clientPackage: { client: { clientProfile: { user: { id: { equals: ownerId(session) } } } } } };
  },
  canReadDepositAdjustments: ({ session }) => {
    if (!session) return false;
    if (anyPermission(session, [permissions.canManagePayments, permissions.canIssueRefunds, permissions.canViewReports])) return true;
    return { paymentSession: { appointment: { client: { user: { id: { equals: ownerId(session) } } } } } };
  }
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/privacy.ts
var workflowOwned = { create: () => false, update: () => false };
var compensationRead = ({ session }) => permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session });
var operationalRead = ({ session }) => permissions.canManageAppointments({ session }) || permissions.canManagePayments({ session });
var ownCareRead = ({ session, item }) => permissions.canManageCareRecords({ session }) || Boolean(session?.itemId && item?.userId === session.itemId);
async function validateCarePhotos({ inputData, context, addValidationError }) {
  for (const key of ["photos", "photo"]) {
    const value = inputData[key];
    if (!value || typeof value !== "object") continue;
    const nestedCreates = value.create ? Array.isArray(value.create) ? value.create : [value.create] : [];
    if (nestedCreates.some((image2) => !image2 || typeof image2 !== "object" || image2.visibility === "public")) {
      addValidationError("Care records can only create or attach private images");
    }
    const linked = [value.connect, value.set].flatMap(
      (part) => part ? Array.isArray(part) ? part : [part] : []
    );
    for (const target of linked) {
      const id = target && typeof target === "object" ? target.id : null;
      if (typeof id !== "string" || !id) {
        addValidationError("Care image selection is invalid");
        continue;
      }
      const image2 = await context.sudo().query.SalonImage.findOne({ where: { id }, query: "id visibility" });
      if (!image2 || image2.visibility !== "private") addValidationError("Care records can only attach private images");
    }
  }
}

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      create: permissions.canManagePeople,
      query: isSignedIn,
      update: isSignedIn,
      delete: () => false
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
    name: (0, import_fields2.text)({
      validation: {
        isRequired: true
      }
    }),
    email: (0, import_fields2.text)({
      isIndexed: "unique",
      validation: {
        isRequired: true
      },
      // Identity changes require a separate verified workflow; self-update must not be an email-claim path.
      access: { update: () => false }
    }),
    password: (0, import_fields2.password)({
      access: {
        read: import_access2.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    role: (0, import_fields2.relationship)({
      ref: "Role.assignedTo",
      access: {
        create: permissions.canManageRoles,
        update: permissions.canManageRoles
      },
      ui: {
        itemView: {
          fieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read"
        }
      }
    }),
    phone: (0, import_fields2.text)({
      ui: {
        description: "Primary phone number for staff and clients"
      }
    }),
    clientProfile: (0, import_fields2.relationship)({
      ref: "Client.user",
      access: workflowOwned,
      ui: {
        itemView: { fieldMode: "read" },
        description: "Salon client profile linked to this authenticated user"
      }
    }),
    formSubmissions: (0, import_fields2.relationship)({ ref: "FormSubmission.client", many: true, access: workflowOwned }),
    consultationSubmissions: (0, import_fields2.relationship)({ ref: "ConsultationSubmission.client", many: true, access: workflowOwned }),
    clientPackages: (0, import_fields2.relationship)({ ref: "ClientPackage.client", many: true, access: workflowOwned }),
    clientMemberships: (0, import_fields2.relationship)({ ref: "ClientMembership.client", many: true, access: workflowOwned }),
    purchasedGiftCards: (0, import_fields2.relationship)({ ref: "GiftCard.purchasedBy", many: true, access: workflowOwned }),
    clientPointsRecords: (0, import_fields2.relationship)({ ref: "ClientPoints.client", many: true, access: workflowOwned }),
    referralsMade: (0, import_fields2.relationship)({ ref: "Referral.referrer", many: true, access: workflowOwned }),
    referralsReceived: (0, import_fields2.relationship)({ ref: "Referral.referred", many: true, access: workflowOwned }),
    messageLogs: (0, import_fields2.relationship)({ ref: "MessageLog.recipient", many: true, access: workflowOwned }),
    onboardingStatus: (0, import_fields2.select)({
      access: { create: permissions.canManageOnboarding, update: permissions.canManageOnboarding },
      type: "string",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started",
      ui: {
        description: "Salon onboarding progress for the dashboard seed flow"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access4 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access4.allOperations)(permissions.canManageRoles),
      query: isSignedIn
    },
    filter: {
      query: ({ session }) => permissions.canManageRoles({ session }) ? true : { assignedTo: { some: { id: { equals: session?.itemId } } } }
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
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    canCreateTodos: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageAllTodos: (0, import_fields3.checkbox)({ defaultValue: false }),
    canSeeOtherPeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields3.checkbox)({ defaultValue: false }),
    canAccessDashboard: (0, import_fields3.checkbox)({ defaultValue: false, label: "Can sign in to the operations dashboard" }),
    canManageSalon: (0, import_fields3.checkbox)({ defaultValue: false, label: "Salon manager: grants every operational domain permission" }),
    canManageAppointments: (0, import_fields3.checkbox)({ defaultValue: false, label: "Reception: manage appointments, waitlist, and arrivals" }),
    canManageClients: (0, import_fields3.checkbox)({ defaultValue: false, label: "Client CRM: manage identity, preferences, benefits, and ordinary history" }),
    canManageCareRecords: (0, import_fields3.checkbox)({ defaultValue: false, label: "Restricted care data: consultation answers, signatures, and review evidence" }),
    canManageCatalog: (0, import_fields3.checkbox)({ defaultValue: false, label: "Catalog: manage services, memberships, packages, and offers" }),
    canManageSchedules: (0, import_fields3.checkbox)({ defaultValue: false, label: "Scheduling manager: manage all staff schedules" }),
    canManageOwnSchedule: (0, import_fields3.checkbox)({ defaultValue: false, label: "Stylist: manage only the signed-in stylist schedule" }),
    canManageResources: (0, import_fields3.checkbox)({ defaultValue: false, label: "Resources: manage rooms, chairs, and equipment" }),
    canManageInventory: (0, import_fields3.checkbox)({ defaultValue: false, label: "Inventory: manage products and stock movements" }),
    canManagePayments: (0, import_fields3.checkbox)({ defaultValue: false, label: "Finance: take and confirm payments, checkout, and tips" }),
    canIssueRefunds: (0, import_fields3.checkbox)({ defaultValue: false, label: "Refund authority: issue payment and gift-card refunds" }),
    canManageCommissions: (0, import_fields3.checkbox)({ defaultValue: false, label: "Commission authority: review and mark payouts" }),
    canViewReports: (0, import_fields3.checkbox)({ defaultValue: false, label: "Reporting: view settled financial and operational reports" }),
    canManageIntegrations: (0, import_fields3.checkbox)({ defaultValue: false, label: "Integrations: manage providers and inspect delivery exceptions" }),
    canManageOnboarding: (0, import_fields3.checkbox)({
      defaultValue: false,
      label: "Can run salon onboarding and apply the deterministic starter dataset"
    }),
    assignedTo: (0, import_fields3.relationship)({
      ref: "User.role",
      many: true,
      access: workflowOwned,
      ui: {
        itemView: { fieldMode: "read" }
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/SalonImage.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var SalonImage = (0, import_core3.list)({
  access: {
    operation: {
      query: () => true,
      create: (args) => permissions.canManageCatalog(args) || permissions.canManageCareRecords(args),
      update: permissions.canManageCatalog,
      delete: () => false
    },
    filter: {
      query: (args) => permissions.canManageCareRecords(args) ? true : { visibility: { equals: "public" } },
      update: () => ({ visibility: { equals: "public" } })
    }
  },
  ui: {
    listView: {
      initialColumns: ["altText", "imagePath", "image"]
    }
  },
  fields: {
    visibility: (0, import_fields4.select)({
      type: "enum",
      options: [{ label: "Private care record", value: "private" }, { label: "Public marketing asset", value: "public" }],
      defaultValue: "private",
      validation: { isRequired: true },
      access: { create: permissions.canManageCatalog, update: () => false },
      ui: { description: "Classification is permanent. Publish a separate consented marketing copy, never a care-record attachment." }
    }),
    image: (0, import_fields4.image)({
      storage: "my_images"
    }),
    imagePath: (0, import_fields4.text)({
      ui: {
        description: "Relative public image path (for example /images/services/signature-cut-blowout.svg)"
      }
    }),
    altText: (0, import_fields4.text)({
      ui: {
        description: "Alternative text for the image (accessibility)"
      }
    }),
    publicMetadata: (0, import_fields4.virtual)({ field: import_core3.graphql.field({ type: import_core3.graphql.JSON, resolve(item) {
      if (item.visibility !== "public") return null;
      const source = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      return Object.fromEntries(["placement", "title", "caption", "serviceId"].filter((key) => typeof source[key] === "string").map((key) => [key, source[key]]));
    } }) }),
    metadata: (0, import_fields4.json)({
      access: { read: (args) => permissions.canManageCatalog(args) || permissions.canManageCareRecords(args) },
      ui: {
        description: "Additional metadata about the image"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ServiceCategory.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var ServiceCategory = (0, import_core4.list)({
  access: {
    operation: {
      query: () => true,
      // Category writes use the validated, auditable salon management workflow.
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "sortOrder", "services"]
    }
  },
  fields: {
    name: (0, import_fields5.text)({
      validation: { isRequired: true },
      ui: {
        description: "Category name (e.g., Hair, Nails, Skin, Massage, Makeup)"
      }
    }),
    description: (0, import_fields5.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    slug: (0, import_fields5.text)({
      isIndexed: "unique",
      ui: {
        description: "URL-friendly slug (auto-generated from name)"
      }
    }),
    parent: (0, import_fields5.relationship)({
      ref: "ServiceCategory",
      ui: {
        displayMode: "select",
        description: "Parent category (for subcategories)"
      }
    }),
    displayOrder: (0, import_fields5.integer)({
      defaultValue: 0,
      ui: {
        description: "Sort order for display"
      }
    }),
    // Legacy field
    sortOrder: (0, import_fields5.integer)({
      defaultValue: 0,
      ui: {
        description: "Order in which categories appear in the service menu (legacy)"
      }
    }),
    isVisible: (0, import_fields5.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this category is visible on the storefront"
      }
    }),
    icon: (0, import_fields5.text)({
      ui: {
        description: "Icon name or emoji for the category"
      }
    }),
    // Relationships
    services: (0, import_fields5.relationship)({
      ref: "Service.category",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineCreate: { fields: ["name", "basePrice", "baseDuration"] },
        inlineEdit: { fields: ["name", "basePrice", "baseDuration"] }
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Service.ts
var import_core5 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
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
      // Keep core service writes on the validated, auditable catalog workflow.
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => session ? true : { AND: [
        { status: { equals: "active" } },
        { requiresConsultation: { equals: false } },
        { requiresPatchTest: { equals: false } }
      ] }
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "category", "basePrice", "baseDuration"]
    }
  },
  fields: {
    name: (0, import_fields6.text)({
      validation: { isRequired: true },
      ui: {
        description: "Service name (e.g., Haircut, Color, Highlights, Manicure, Facial)"
      }
    }),
    description: (0, import_fields6.text)({
      ui: {
        displayMode: "textarea"
      }
    }),
    baseDuration: (0, import_fields6.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Duration in minutes"
      }
    }),
    // Price in cents for consistency with other models
    price: (0, import_fields6.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Base price in cents"
      }
    }),
    // Deprecated alias retained for API compatibility; values are cents.
    basePrice: (0, import_fields6.integer)({
      ui: {
        description: "Base price in cents (deprecated; use price)"
      }
    }),
    depositRequired: (0, import_fields6.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether a deposit is required to book this service"
      }
    }),
    depositAmount: (0, import_fields6.integer)({
      ui: {
        description: "Deposit amount required in cents"
      }
    }),
    status: (0, import_fields6.select)({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" }
      ],
      defaultValue: "active"
    }),
    metadata: (0, import_fields6.json)({
      ui: {
        description: "Additional service metadata"
      }
    }),
    pricingTier: (0, import_fields6.json)({
      ui: {
        description: "Pricing by stylist tier, e.g., {junior: 50, senior: 75, master: 100}"
      }
    }),
    requiresConsultation: (0, import_fields6.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a consultation first"
      }
    }),
    requiresPatchTest: (0, import_fields6.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this service requires a patch test (e.g., for color services)"
      }
    }),
    // Relationships
    category: (0, import_fields6.relationship)({
      ref: "ServiceCategory.services",
      ui: {
        displayMode: "select"
      }
    }),
    // Image relationship (optional - for service photos)
    image: (0, import_fields6.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "imagePath", "altText"],
        inlineCreate: { fields: ["imagePath", "altText"] },
        inlineEdit: { fields: ["imagePath", "altText"] }
      }
    }),
    // Stylists who specialize in this service
    specialists: (0, import_fields6.relationship)({
      ref: "Stylist.specializations",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    requiredResources: (0, import_fields6.relationship)({
      ref: "SalonResource.services",
      many: true,
      ui: {
        displayMode: "count",
        description: "Rooms, chairs, stations, or equipment required to deliver this service"
      }
    }),
    reviews: (0, import_fields6.relationship)({
      ref: "Review.service",
      many: true,
      access: workflowOwned,
      ui: {
        displayMode: "count"
      }
    }),
    segmentDefinitions: (0, import_fields6.relationship)({
      ref: "ServiceSegment.service",
      many: true,
      access: workflowOwned,
      ui: { displayMode: "count", description: "Effective-dated, append-only service timing segments" }
    }),
    variants: (0, import_fields6.relationship)({
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
    formattedPrice: (0, import_fields6.virtual)({
      field: import_core5.graphql.field({
        type: import_core5.graphql.String,
        async resolve(item, args, context) {
          const serviceId = item.id;
          const service = await context.sudo().query.Service.findOne({
            where: { id: serviceId },
            query: "price"
          });
          if (!service?.price) return "$0.00";
          return formatCurrency(service.price / 100);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/ServiceVariant.ts
var import_core6 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
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
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "service", "price", "duration", "displayOrder"]
    },
    labelField: "name"
  },
  fields: {
    name: (0, import_fields7.text)({
      validation: { isRequired: true },
      ui: {
        description: "Variant name (e.g., Junior Stylist, Senior Stylist, Master Stylist)"
      }
    }),
    service: (0, import_fields7.relationship)({
      ref: "Service.variants",
      ui: {
        displayMode: "select",
        description: "The service this variant belongs to"
      }
    }),
    price: (0, import_fields7.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Price in cents (overrides base service price if set)"
      }
    }),
    duration: (0, import_fields7.integer)({
      ui: {
        description: "Duration in minutes (overrides base service duration if different)"
      }
    }),
    staffLevel: (0, import_fields7.text)({
      ui: {
        description: "Staff level/tier this variant applies to (e.g., junior, senior, master)"
      }
    }),
    displayOrder: (0, import_fields7.integer)({
      defaultValue: 0,
      ui: {
        description: "Order in which this variant appears"
      }
    }),
    formattedPrice: (0, import_fields7.virtual)({
      field: import_core6.graphql.field({
        type: import_core6.graphql.String,
        async resolve(item, args, context) {
          const variantId = item.id;
          const variant = await context.sudo().query.ServiceVariant.findOne({
            where: { id: variantId },
            query: "price"
          });
          if (!variant?.price) return "$0.00";
          return formatCurrency2(variant.price);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Stylist.ts
var import_core7 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");

// features/keystone/lifecycle.ts
var import_node_crypto = require("node:crypto");
function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, child]) => child !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}
function snapshot(item, fields) {
  const record = item || {};
  return Object.fromEntries(fields.filter((field) => field in record).map((field) => [field, canonicalize(record[field])]));
}
function payloadHash(payload) {
  return (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}
async function enqueueDomainEvent(context, input) {
  const occurredAt = input.occurredAt || /* @__PURE__ */ new Date();
  const hash2 = payloadHash(input.payload);
  await context.prisma.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
    "salon-domain-outbox",
    input.eventKey
  );
  const existing = await context.sudo().query.DomainEvent.findOne({
    where: { eventKey: input.eventKey },
    query: "id eventType payloadHash"
  });
  if (existing) {
    if (existing.eventType !== input.eventType || existing.payloadHash !== hash2) {
      throw new Error("Domain event key was reused with different immutable evidence");
    }
    return { id: existing.id, created: false };
  }
  const event = await context.sudo().query.DomainEvent.createOne({
    data: {
      eventKey: input.eventKey,
      eventType: input.eventType,
      eventVersion: 1,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      operation: input.operation,
      actorId: context.session?.itemId || "system",
      locationId: input.locationId || "",
      payload: input.payload,
      payloadHash: hash2,
      occurredAt: occurredAt.toISOString(),
      status: "pending",
      attempts: 0
    },
    query: "id"
  });
  return { id: event.id, created: true };
}
function createLifecycleHooks(aggregateType, fields) {
  return {
    afterOperation: async ({ operation, item, originalItem, context }) => {
      const aggregateId = String(item?.id || originalItem?.id || "");
      if (!aggregateId) throw new Error(`${aggregateType} lifecycle event is missing its aggregate id`);
      const versionSource = item?.updatedAt || item?.createdAt || originalItem?.updatedAt || originalItem?.createdAt;
      const version = versionSource ? new Date(versionSource).toISOString() : `${operation}:v1`;
      const before = operation === "create" ? null : snapshot(originalItem, fields);
      const after = operation === "delete" ? null : snapshot(item, fields);
      if (operation === "update" && JSON.stringify(canonicalize(before)) === JSON.stringify(canonicalize(after))) return;
      const payload = { aggregateType, aggregateId, operation, before, after };
      await enqueueDomainEvent(context, {
        eventKey: `${aggregateType}:${aggregateId}:${operation}:${version}:${payloadHash(payload).slice(0, 16)}`,
        eventType: `salon.${aggregateType}.${operation}.v1`,
        aggregateType,
        aggregateId,
        operation,
        locationId: String(item?.locationId || originalItem?.locationId || "") || null,
        payload,
        occurredAt: versionSource ? new Date(versionSource) : /* @__PURE__ */ new Date()
      });
    }
  };
}

// features/keystone/models/Stylist.ts
var Stylist = (0, import_core7.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  hooks: createLifecycleHooks("stylist", ["role", "tier", "baseCommissionRate", "status", "isActive", "userId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["user", "tier", "commissionRate", "isActive"]
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
    // Role field as specified in Staff Management todo
    role: (0, import_fields8.select)({
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
    tier: (0, import_fields8.select)({
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
    bio: (0, import_fields8.text)({
      ui: {
        displayMode: "textarea",
        description: "Professional biography"
      }
    }),
    // Base commission rate (percentage as float)
    baseCommissionRate: (0, import_fields8.float)({
      access: { read: ({ session }) => permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session }) },
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Base commission rate as percentage (e.g., 0.5 for 50%)"
      }
    }),
    // Legacy field
    commissionRate: (0, import_fields8.float)({
      access: { read: ({ session }) => permissions.canManageCommissions({ session }) || permissions.canManagePayments({ session }) || permissions.canViewReports({ session }) },
      defaultValue: 0.5,
      validation: { min: 0, max: 1 },
      ui: {
        description: "Commission rate as decimal (legacy - use baseCommissionRate)"
      }
    }),
    certifications: (0, import_fields8.json)({
      access: { read: permissions.canManagePeople },
      ui: {
        description: "Array of certifications: [{name, issuer, date, expiryDate}]"
      }
    }),
    hireDate: (0, import_fields8.timestamp)({
      access: { read: permissions.canManagePeople },
      ui: {
        description: "Date staff member was hired"
      }
    }),
    employmentType: (0, import_fields8.select)({
      access: { read: permissions.canManagePeople },
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
    status: (0, import_fields8.select)({
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
    isActive: (0, import_fields8.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether stylist is currently active (legacy - use status)"
      }
    }),
    photoUrl: (0, import_fields8.text)({
      ui: {
        description: "Legacy staff photo path; prefer the SalonImage imagePath relationship below"
      }
    }),
    socialMedia: (0, import_fields8.json)({
      ui: {
        description: "Social media handles: {instagram, facebook, etc}"
      }
    }),
    // Photo relationship
    photo: (0, import_fields8.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "imagePath", "altText"],
        inlineCreate: { fields: ["imagePath", "altText"] },
        inlineEdit: { fields: ["imagePath", "altText"] }
      }
    }),
    // Services this stylist specializes in
    specializations: (0, import_fields8.relationship)({
      ref: "Service.specialists",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice"]
      }
    }),
    locations: (0, import_fields8.relationship)({ ref: "Location.stylists", many: true }),
    segmentQualifications: (0, import_fields8.relationship)({ ref: "ServiceSegment.qualifiedPractitioners", many: true }),
    appointmentSegments: (0, import_fields8.relationship)({ ref: "AppointmentSegment.practitioner", many: true }),
    gratuityEntries: (0, import_fields8.relationship)({ ref: "GratuityLedgerEntry.practitioner", many: true }),
    // Schedules for this stylist
    schedules: (0, import_fields8.relationship)({
      ref: "StylistSchedule.stylist",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["dayOfWeek", "startTime", "endTime", "isAvailable"]
      }
    }),
    // Appointments assigned to this stylist
    appointments: (0, import_fields8.relationship)({
      ref: "Appointment.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Clients who prefer this stylist
    preferredByClients: (0, import_fields8.relationship)({
      ref: "Client.preferredStylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Color formulas created by this stylist
    colorFormulas: (0, import_fields8.relationship)({
      ref: "ColorFormula.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    // Waitlist entries where this stylist is preferred
    waitlistEntries: (0, import_fields8.relationship)({
      ref: "WaitlistEntry.preferredStylists",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    reviews: (0, import_fields8.relationship)({
      ref: "Review.stylist",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Client.ts
var import_core8 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var Client = (0, import_core8.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadClients
    }
  },
  hooks: createLifecycleHooks("client", ["userId", "preferredStylistId", "homeLocationId", "totalVisits", "lifetimeValue", "marketingConsent"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["user", "hairType", "preferredStylist", "totalVisits", "lifetimeValue"]
    }
  },
  fields: {
    // Link to User for contact info
    user: (0, import_fields9.relationship)({
      ref: "User.clientProfile",
      ui: {
        displayMode: "select"
      }
    }),
    homeLocation: (0, import_fields9.relationship)({ ref: "Location.clients" }),
    dateOfBirth: (0, import_fields9.timestamp)({
      access: { read: ownCareRead },
      ui: {
        description: "Client's date of birth"
      }
    }),
    // Preferred stylist
    preferredStylist: (0, import_fields9.relationship)({
      ref: "Stylist.preferredByClients",
      ui: {
        displayMode: "select"
      }
    }),
    // Health and sensitivity information
    allergies: (0, import_fields9.text)({
      access: { read: ownCareRead },
      ui: {
        displayMode: "textarea",
        description: "Known allergies (e.g., latex, certain dyes)"
      }
    }),
    skinSensitivities: (0, import_fields9.text)({
      access: { read: ownCareRead },
      ui: {
        displayMode: "textarea",
        description: "Skin sensitivities or conditions"
      }
    }),
    skinType: (0, import_fields9.select)({
      access: { read: ownCareRead },
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
    hairType: (0, import_fields9.select)({
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
    hairTexture: (0, import_fields9.select)({
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
    scalpCondition: (0, import_fields9.select)({
      access: { read: ownCareRead },
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
    notes: (0, import_fields9.text)({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Internal notes about client preferences and history"
      }
    }),
    // Visit tracking
    firstVisit: (0, import_fields9.timestamp)({
      ui: {
        description: "Date of first visit"
      }
    }),
    lastVisit: (0, import_fields9.timestamp)({
      ui: {
        description: "Date of most recent visit"
      }
    }),
    totalVisits: (0, import_fields9.integer)({
      defaultValue: 0,
      ui: {
        description: "Total number of visits"
      }
    }),
    lifetimeValue: (0, import_fields9.integer)({
      defaultValue: 0,
      validation: { min: 0 },
      ui: {
        description: "Total revenue from this client in cents"
      }
    }),
    // Consent
    photoConsent: (0, import_fields9.checkbox)({
      defaultValue: false,
      ui: {
        description: "Consent to use photos for marketing"
      }
    }),
    marketingConsent: (0, import_fields9.checkbox)({
      defaultValue: false,
      ui: {
        description: "Consent to receive marketing communications"
      }
    }),
    // Relationships
    appointments: (0, import_fields9.relationship)({
      ref: "Appointment.client",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    colorFormulas: (0, import_fields9.relationship)({
      ref: "ColorFormula.client",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["formulaName", "createdAt"]
      }
    }),
    reviews: (0, import_fields9.relationship)({
      ref: "Review.client",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ClientNote.ts
var import_core9 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var ClientNote = (0, import_core9.list)({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      // Client-care notes are historical evidence; append corrections instead
      // of erasing or silently rewriting prior observations.
      update: () => false,
      delete: () => false
    }
  },
  hooks: { validateInput: validateCarePhotos },
  ui: {
    listView: {
      initialColumns: ["client", "author", "isPrivate", "createdAt"]
    }
  },
  fields: {
    client: (0, import_fields10.relationship)({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client this note is about"
      }
    }),
    author: (0, import_fields10.relationship)({
      ref: "User",
      access: { create: permissions.canManageCareRecords, update: () => false },
      hooks: { resolveInput: ({ operation, context }) => {
        if (operation !== "create") return void 0;
        if (!context.session?.itemId) throw new Error("Care note author must be the authenticated actor");
        return { connect: { id: context.session.itemId } };
      } },
      ui: {
        displayMode: "select",
        description: "Staff member who wrote this note"
      }
    }),
    content: (0, import_fields10.text)({
      ui: {
        displayMode: "textarea",
        description: "Note content"
      },
      validation: {
        isRequired: true
      }
    }),
    isPrivate: (0, import_fields10.checkbox)({
      defaultValue: true,
      ui: {
        description: "Visible only to staff (not shown to client)"
      }
    }),
    appointment: (0, import_fields10.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Related appointment (if any)"
      }
    }),
    photos: (0, import_fields10.relationship)({
      ref: "SalonImage",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        description: "Before/after photos"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ColorFormula.ts
var import_core10 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var ColorFormula = (0, import_core10.list)({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      // Preserve the exact formula used for each service. A correction is a
      // new formula record, not a destructive edit of client history.
      update: () => false,
      delete: () => false
    }
  },
  hooks: { validateInput: validateCarePhotos },
  ui: {
    listView: {
      initialColumns: ["formulaName", "client", "stylist", "createdAt"]
    }
  },
  fields: {
    formulaName: (0, import_fields11.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name for this formula (e.g., Summer Blonde 2024)"
      }
    }),
    // Products and ratios
    products: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "List of products/colors used"
      }
    }),
    measurements: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "Exact ratios and measurements (e.g., 30ml A + 15ml B)"
      }
    }),
    processingTime: (0, import_fields11.integer)({
      ui: {
        description: "Processing time in minutes"
      }
    }),
    result: (0, import_fields11.text)({
      ui: {
        displayMode: "textarea",
        description: "How the color turned out, notes for future reference"
      }
    }),
    // Relationships
    client: (0, import_fields11.relationship)({
      ref: "Client.colorFormulas",
      ui: {
        displayMode: "select"
      }
    }),
    stylist: (0, import_fields11.relationship)({
      ref: "Stylist.colorFormulas",
      ui: {
        displayMode: "select"
      }
    }),
    // Appointment when this formula was applied
    appointment: (0, import_fields11.relationship)({
      ref: "Appointment.colorFormula",
      ui: {
        displayMode: "select"
      }
    }),
    // Before/after photo
    photo: (0, import_fields11.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"]
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/StylistSchedule.ts
var import_core11 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var StylistSchedule = (0, import_core11.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => {
        if (permissions.canManageSchedules({ session })) return true;
        if (permissions.canManageOwnSchedule({ session }) && session?.itemId) return { stylist: { user: { id: { equals: session.itemId } } } };
        return { isAvailable: { equals: true }, type: { in: ["recurring", "one_time"] } };
      }
    }
  },
  hooks: createLifecycleHooks("stylist_schedule", ["type", "dayOfWeek", "localDate", "startTime", "endTime", "isAvailable", "revision", "stylistId", "locationId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["stylist", "dayOfWeek", "startTime", "endTime", "isAvailable"]
    }
  },
  fields: {
    type: (0, import_fields12.select)({
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
    idempotencyKey: (0, import_fields12.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Stable workflow key for idempotent schedule creation"
      }
    }),
    revision: (0, import_fields12.integer)({
      defaultValue: 1,
      validation: { isRequired: true, min: 1 },
      ui: {
        description: "Optimistic concurrency revision managed by schedule workflows"
      }
    }),
    // Day of week for recurring schedules (0-6, Sunday = 0)
    dayOfWeek: (0, import_fields12.integer)({
      validation: {
        min: 0,
        max: 6
      },
      ui: {
        description: "Day of week (0=Sunday, 1=Monday, etc) for recurring schedules"
      }
    }),
    // Legacy string-based day of week
    dayOfWeekLegacy: (0, import_fields12.select)({
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
    localDate: (0, import_fields12.text)({
      ui: {
        description: "Salon-local YYYY-MM-DD date for one-time and time-off entries"
      }
    }),
    // Legacy timestamp mirror for one-time or time-off entries
    date: (0, import_fields12.timestamp)({
      ui: {
        description: "Specific date for one-time schedule or time-off"
      }
    }),
    startTime: (0, import_fields12.text)({
      validation: { isRequired: true },
      ui: {
        description: "Start time in HH:MM format (e.g., 09:00)"
      }
    }),
    endTime: (0, import_fields12.text)({
      validation: { isRequired: true },
      ui: {
        description: "End time in HH:MM format (e.g., 17:00)"
      }
    }),
    isAvailable: (0, import_fields12.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether stylist is available on this day (false for time off)"
      }
    }),
    // Break times
    breakStart: (0, import_fields12.text)({
      ui: {
        description: "Lunch/break start time in HH:MM format"
      }
    }),
    breakEnd: (0, import_fields12.text)({
      ui: {
        description: "Lunch/break end time in HH:MM format"
      }
    }),
    reason: (0, import_fields12.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for time-off or special schedule"
      }
    }),
    // Schedule validity period
    effectiveFrom: (0, import_fields12.timestamp)({
      ui: {
        description: "When this schedule starts being effective"
      }
    }),
    effectiveTo: (0, import_fields12.timestamp)({
      ui: {
        description: "When this schedule ends (null for ongoing recurring schedules)"
      }
    }),
    // Legacy fields
    effectiveDate: (0, import_fields12.timestamp)({
      ui: {
        description: "When this schedule starts being effective (legacy - use effectiveFrom)"
      }
    }),
    endDate: (0, import_fields12.timestamp)({
      ui: {
        description: "When this schedule ends (legacy - use effectiveTo)"
      }
    }),
    location: (0, import_fields12.relationship)({ ref: "Location.schedules" }),
    // Relationship to stylist
    stylist: (0, import_fields12.relationship)({
      ref: "Stylist.schedules",
      ui: {
        displayMode: "select"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Appointment.ts
var import_core12 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var Appointment = (0, import_core12.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadAppointments
    }
  },
  hooks: createLifecycleHooks("appointment", ["startTime", "endTime", "duration", "status", "depositAmount", "depositPaid", "locationId", "clientId", "stylistId", "resourceId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["client", "stylist", "startTime", "status", "duration"]
    }
  },
  fields: {
    startTime: (0, import_fields13.timestamp)({
      validation: { isRequired: true },
      ui: {
        description: "Start date and time of the appointment"
      }
    }),
    endTime: (0, import_fields13.timestamp)({
      ui: {
        description: "End date and time of the appointment"
      }
    }),
    duration: (0, import_fields13.integer)({
      defaultValue: 60,
      ui: {
        description: "Total duration in minutes"
      }
    }),
    status: (0, import_fields13.select)({
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
    depositAmount: (0, import_fields13.integer)({
      ui: {
        description: "Deposit amount required in cents"
      }
    }),
    depositPaid: (0, import_fields13.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether deposit has been paid"
      }
    }),
    clientPolicy: (0, import_fields13.virtual)({ field: import_core12.graphql.field({ type: import_core12.graphql.JSON, resolve(item) {
      const policy = item.metadata?.clientPolicySnapshot;
      return policy ? Object.fromEntries(["version", "acceptedAt", "effectiveFrom", "effectiveUntil", "revokedAt", "cancellationNoticeMinutes", "rescheduleNoticeMinutes", "cancellationDeadline", "rescheduleDeadline"].map((key) => [key, policy[key] ?? null])) : null;
    } }) }),
    metadata: (0, import_fields13.json)({
      access: { read: operationalRead },
      ui: {
        description: "Additional metadata for the appointment"
      }
    }),
    // Timestamps
    bookedAt: (0, import_fields13.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the appointment was booked"
      }
    }),
    confirmedAt: (0, import_fields13.timestamp)({
      ui: {
        description: "When the appointment was confirmed"
      }
    }),
    cancelledAt: (0, import_fields13.timestamp)({
      ui: {
        description: "When the appointment was cancelled"
      }
    }),
    cancellationReason: (0, import_fields13.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for cancellation"
      }
    }),
    // Notes
    notes: (0, import_fields13.text)({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Notes and special requests"
      }
    }),
    clientNotes: (0, import_fields13.text)({
      ui: {
        displayMode: "textarea",
        description: "Special requests from client"
      }
    }),
    internalNotes: (0, import_fields13.text)({
      access: { read: permissions.canManageCareRecords },
      ui: {
        displayMode: "textarea",
        description: "Internal notes for stylists"
      }
    }),
    // Relationships
    location: (0, import_fields13.relationship)({ ref: "Location.appointments" }),
    client: (0, import_fields13.relationship)({
      ref: "Client.appointments",
      ui: {
        displayMode: "select"
      }
    }),
    stylist: (0, import_fields13.relationship)({
      ref: "Stylist.appointments",
      ui: {
        displayMode: "select"
      }
    }),
    resource: (0, import_fields13.relationship)({
      ref: "SalonResource.appointments",
      ui: {
        displayMode: "select",
        description: "Room, chair, station, or equipment reserved for this appointment"
      }
    }),
    // Services booked for this appointment (can book multiple)
    services: (0, import_fields13.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"]
      }
    }),
    segments: (0, import_fields13.relationship)({ ref: "AppointmentSegment.appointment", many: true }),
    scheduleRevisions: (0, import_fields13.relationship)({ ref: "AppointmentScheduleRevision.appointment", many: true }),
    consultationSubmissions: (0, import_fields13.relationship)({ ref: "ConsultationSubmission.appointment", many: true }),
    // Line items for detailed service tracking
    lineItems: (0, import_fields13.relationship)({
      ref: "AppointmentLineItem.appointment",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["service", "staff", "duration", "formattedPrice"]
      }
    }),
    // Color formula applied during this appointment
    colorFormula: (0, import_fields13.relationship)({
      ref: "ColorFormula.appointment",
      ui: {
        displayMode: "select"
      }
    }),
    // Payment for this appointment
    payment: (0, import_fields13.relationship)({
      ref: "Payment.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["totalAmount", "status", "paymentMethod"]
      }
    }),
    paymentSessions: (0, import_fields13.relationship)({
      ref: "PaymentSession.appointment",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    transaction: (0, import_fields13.relationship)({
      ref: "SalonTransaction.appointment",
      ui: {
        displayMode: "cards",
        cardFields: ["paymentStatus", "status", "paymentMethod"],
        description: "Checkout transaction for this appointment"
      }
    }),
    // Review for this appointment
    inventoryMovements: (0, import_fields13.relationship)({ ref: "InventoryMovement.appointment", many: true }),
    review: (0, import_fields13.relationship)({
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
        formattedDuration: (0, import_fields13.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.String,
            async resolve(item, args, context) {
              const appointmentId = item.id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
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
        isUpcoming: (0, import_fields13.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.Boolean,
            async resolve(item, args, context) {
              const appointmentId = item.id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
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
        isPast: (0, import_fields13.virtual)({
          field: import_core12.graphql.field({
            type: import_core12.graphql.Boolean,
            async resolve(item, args, context) {
              const appointmentId = item.id;
              const appointment = await context.sudo().query.Appointment.findOne({
                where: { id: appointmentId },
                query: "startTime"
              });
              if (!appointment?.startTime) return false;
              return new Date(appointment.startTime) < /* @__PURE__ */ new Date();
            }
          })
        })
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/AppointmentLineItem.ts
var import_core13 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
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
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadAppointmentLineItems
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["serviceTitle", "staff", "duration", "price", "appointment"]
    }
  },
  fields: {
    service: (0, import_fields14.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service being provided"
      }
    }),
    staff: (0, import_fields14.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member providing this service"
      }
    }),
    serviceTitle: (0, import_fields14.text)({
      validation: { isRequired: true, length: { max: 300 } },
      ui: {
        description: "Immutable service title captured when the appointment was booked"
      }
    }),
    serviceImagePath: (0, import_fields14.text)({
      ui: {
        description: "Immutable canonical relative service media path captured at booking"
      }
    }),
    duration: (0, import_fields14.integer)({
      defaultValue: 60,
      validation: { isRequired: true, min: 1 },
      ui: {
        description: "Immutable service duration captured at booking"
      }
    }),
    price: (0, import_fields14.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Price in cents"
      }
    }),
    quantity: (0, import_fields14.integer)({
      defaultValue: 1,
      validation: { isRequired: true, min: 1 },
      ui: {
        description: "Quantity of this service (usually 1)"
      }
    }),
    notes: (0, import_fields14.text)({
      ui: {
        displayMode: "textarea",
        description: "Special requests or notes for this service"
      }
    }),
    segments: (0, import_fields14.relationship)({ ref: "AppointmentSegment.lineItem", many: true }),
    appointment: (0, import_fields14.relationship)({
      ref: "Appointment.lineItems",
      ui: {
        displayMode: "select",
        description: "Related appointment"
      }
    }),
    metadata: (0, import_fields14.json)({
      ui: {
        description: "Additional metadata for the line item"
      }
    }),
    formattedPrice: (0, import_fields14.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.String,
        async resolve(item, args, context) {
          const lineItemId = item.id;
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: lineItemId },
            query: "price"
          });
          if (!lineItem?.price) return "$0.00";
          return formatCurrency3(lineItem.price);
        }
      })
    }),
    formattedTotal: (0, import_fields14.virtual)({
      field: import_core13.graphql.field({
        type: import_core13.graphql.String,
        async resolve(item, args, context) {
          const lineItemId = item.id;
          const lineItem = await context.sudo().query.AppointmentLineItem.findOne({
            where: { id: lineItemId },
            query: "price quantity"
          });
          if (!lineItem?.price || !lineItem?.quantity) return "$0.00";
          const total = lineItem.price * lineItem.quantity;
          return formatCurrency3(total);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Payment.ts
var import_core14 = require("@keystone-6/core");
var import_fields15 = require("@keystone-6/core/fields");
var Payment = (0, import_core14.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadPayments
    }
  },
  hooks: createLifecycleHooks("payment", ["subtotal", "tax", "tip", "discount", "totalAmount", "refundedAmount", "paymentMethod", "status", "processedAt", "refundedAt", "appointmentId", "sessionId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["appointment", "totalAmount", "paymentMethod", "status", "processedAt"]
    }
  },
  fields: {
    // Core amount fields
    subtotal: (0, import_fields15.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Service charges before tax and tip"
      }
    }),
    tax: (0, import_fields15.integer)({
      defaultValue: 0,
      ui: {
        description: "Tax amount"
      }
    }),
    tip: (0, import_fields15.integer)({
      defaultValue: 0,
      ui: {
        description: "Tip amount"
      }
    }),
    discount: (0, import_fields15.integer)({
      defaultValue: 0,
      ui: {
        description: "Any discount applied"
      }
    }),
    totalAmount: (0, import_fields15.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Total amount charged (subtotal + tax + tip - discount)"
      }
    }),
    // Payment method and processing
    paymentMethod: (0, import_fields15.select)({
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
    status: (0, import_fields15.select)({
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
    stripePaymentIntentId: (0, import_fields15.text)({
      ui: {
        description: "Stripe Payment Intent ID for card payments"
      }
    }),
    stripeChargeId: (0, import_fields15.text)({
      ui: {
        description: "Stripe Charge ID for completed payments"
      }
    }),
    stripeRefundId: (0, import_fields15.text)({
      ui: {
        description: "Stripe Refund ID if payment was refunded"
      }
    }),
    // Card details (last 4 digits, brand)
    cardBrand: (0, import_fields15.text)({
      ui: {
        description: "Card brand (Visa, Mastercard, etc.)"
      }
    }),
    cardLast4: (0, import_fields15.text)({
      ui: {
        description: "Last 4 digits of card"
      }
    }),
    // Refund tracking
    refundedAmount: (0, import_fields15.integer)({
      defaultValue: 0,
      ui: {
        description: "Amount refunded"
      }
    }),
    refundReason: (0, import_fields15.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason for refund if applicable"
      }
    }),
    // Tip distribution
    tipDistributed: (0, import_fields15.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether tip has been distributed to stylist"
      }
    }),
    // Timestamps
    processedAt: (0, import_fields15.timestamp)({
      ui: {
        description: "When the payment was successfully processed"
      }
    }),
    refundedAt: (0, import_fields15.timestamp)({
      ui: {
        description: "When the refund was processed"
      }
    }),
    // Notes
    notes: (0, import_fields15.text)({
      ui: {
        displayMode: "textarea",
        description: "Internal notes about the payment"
      }
    }),
    // Relationships
    appointment: (0, import_fields15.relationship)({
      ref: "Appointment.payment",
      ui: {
        displayMode: "select"
      }
    }),
    session: (0, import_fields15.relationship)({
      ref: "PaymentSession.payment",
      ui: {
        displayMode: "select",
        description: "Provider session that created this payment"
      }
    }),
    reversals: (0, import_fields15.relationship)({ ref: "TransactionReversal.payment", many: true }),
    gratuityEntries: (0, import_fields15.relationship)({ ref: "GratuityLedgerEntry.payment", many: true }),
    // Processed by (staff member who processed the payment)
    processedBy: (0, import_fields15.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed this payment"
      }
    }),
    // Receipt tracking
    receiptSent: (0, import_fields15.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether receipt email was sent to client"
      }
    }),
    receiptEmail: (0, import_fields15.text)({
      ui: {
        description: "Email address receipt was sent to"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core15 = require("@keystone-6/core");
var import_fields16 = require("@keystone-6/core/fields");
var PaymentProvider = (0, import_core15.list)({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      // Provider activation is intentionally code/operator controlled until the
      // refund and reconciliation lifecycle is externally verified.
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "code", "adapter", "isInstalled", "isDefault"]
    }
  },
  fields: {
    name: (0, import_fields16.text)({ validation: { isRequired: true } }),
    code: (0, import_fields16.text)({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-z0-9_-]+$/,
          explanation: "Provider codes must start with pp_ and contain lowercase letters, numbers, underscores, or hyphens."
        }
      }
    }),
    adapter: (0, import_fields16.select)({
      type: "enum",
      validation: { isRequired: true },
      options: [
        { label: "Manual / terminal", value: "manual" },
        { label: "Stripe", value: "stripe" }
      ]
    }),
    isInstalled: (0, import_fields16.checkbox)({ defaultValue: false }),
    isDefault: (0, import_fields16.checkbox)({ defaultValue: false }),
    config: (0, import_fields16.json)({
      defaultValue: {},
      ui: {
        description: "Non-secret provider configuration only. API keys and webhook secrets are read from environment variables by the adapter."
      }
    }),
    sessions: (0, import_fields16.relationship)({ ref: "PaymentSession.provider", many: true, access: workflowOwned }),
    webhookEvents: (0, import_fields16.relationship)({ ref: "PaymentWebhookEvent.provider", many: true, access: workflowOwned }),
    ...trackingFields
  }
});

// features/keystone/models/PaymentSession.ts
var import_core16 = require("@keystone-6/core");
var import_fields17 = require("@keystone-6/core/fields");
var PaymentSession = (0, import_core16.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canManagePayments({ session }) || permissions.canIssueRefunds({ session }) || permissions.canViewReports({ session }),
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["appointment", "provider", "status", "amount", "currency", "idempotencyKey"]
    }
  },
  fields: {
    appointment: (0, import_fields17.relationship)({ ref: "Appointment.paymentSessions" }),
    provider: (0, import_fields17.relationship)({ ref: "PaymentProvider.sessions" }),
    payment: (0, import_fields17.relationship)({ ref: "Payment.session" }),
    idempotencyKey: (0, import_fields17.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    amount: (0, import_fields17.integer)({ validation: { isRequired: true, min: 0 } }),
    currency: (0, import_fields17.text)({ defaultValue: "usd", validation: { isRequired: true } }),
    status: (0, import_fields17.select)({
      type: "enum",
      defaultValue: "pending",
      validation: { isRequired: true },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Requires action", value: "requires_action" },
        { label: "Authorized", value: "authorized" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Partially refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" }
      ]
    }),
    providerReference: (0, import_fields17.text)({ isIndexed: true }),
    data: (0, import_fields17.json)({ defaultValue: {} }),
    authorizedAt: (0, import_fields17.timestamp)(),
    completedAt: (0, import_fields17.timestamp)(),
    failedAt: (0, import_fields17.timestamp)(),
    refundedAt: (0, import_fields17.timestamp)(),
    ...trackingFields
  }
});

// features/keystone/models/PaymentWebhookEvent.ts
var import_core17 = require("@keystone-6/core");
var import_fields18 = require("@keystone-6/core/fields");
var PaymentWebhookEvent = (0, import_core17.list)({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["provider", "eventId", "type", "status", "processedAt"] }
  },
  fields: {
    provider: (0, import_fields18.relationship)({ ref: "PaymentProvider.webhookEvents" }),
    replayKey: (0, import_fields18.text)({ isIndexed: "unique", validation: { isRequired: true } }),
    eventId: (0, import_fields18.text)({ validation: { isRequired: true } }),
    type: (0, import_fields18.text)({ validation: { isRequired: true } }),
    providerReference: (0, import_fields18.text)({ isIndexed: true }),
    payloadHash: (0, import_fields18.text)({ validation: { isRequired: true } }),
    status: (0, import_fields18.select)({
      type: "enum",
      defaultValue: "processed",
      validation: { isRequired: true },
      options: [
        { label: "Processed", value: "processed" },
        { label: "Ignored", value: "ignored" }
      ]
    }),
    data: (0, import_fields18.json)({ defaultValue: {} }),
    processedAt: (0, import_fields18.timestamp)({ defaultValue: { kind: "now" } }),
    ...trackingFields
  }
});

// features/keystone/models/ClientPoints.ts
var import_core18 = require("@keystone-6/core");
var import_fields19 = require("@keystone-6/core/fields");
var ClientPoints = (0, import_core18.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients
    },
    filter: {
      query: rules.canReadClientPoints
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
    client: (0, import_fields19.relationship)({
      ref: "User.clientPointsRecords",
      ui: {
        displayMode: "select",
        description: "The client who owns these points"
      }
    }),
    // Current points balance
    points: (0, import_fields19.integer)({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: {
        description: "Current loyalty points balance"
      }
    }),
    // Loyalty tier based on points
    tier: (0, import_fields19.text)({
      defaultValue: "bronze",
      ui: {
        description: "Loyalty tier (e.g., bronze, silver, gold, platinum)"
      }
    }),
    // Transaction history stored as JSON array
    // Each transaction: { date: string, amount: number, reason: string }
    transactions: (0, import_fields19.json)({
      defaultValue: [],
      ui: {
        description: "Array of point transactions with date, amount, and reason",
        createView: { fieldMode: "hidden" }
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Referral.ts
var import_core19 = require("@keystone-6/core");
var import_fields20 = require("@keystone-6/core/fields");
var Referral = (0, import_core19.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients
    },
    filter: {
      query: rules.canReadReferrals
    }
  },
  ui: {
    listView: {
      initialColumns: ["referrer", "referred", "rewardAmount", "rewardType", "status"]
    }
  },
  fields: {
    // The user who made the referral
    referrer: (0, import_fields20.relationship)({
      ref: "User.referralsMade",
      ui: {
        displayMode: "select",
        description: "The client who made the referral"
      }
    }),
    // The new user who was referred
    referred: (0, import_fields20.relationship)({
      ref: "User.referralsReceived",
      ui: {
        displayMode: "select",
        description: "The new client who was referred"
      }
    }),
    // Reward details
    rewardAmount: (0, import_fields20.integer)({
      defaultValue: 0,
      validation: { isRequired: true },
      ui: {
        description: "Amount of reward (points or credit value)"
      }
    }),
    rewardType: (0, import_fields20.select)({
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
    status: (0, import_fields20.select)({
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
    completedAt: (0, import_fields20.timestamp)({
      ui: {
        description: "When the referral was completed (referred client made first purchase)"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/MessageTemplate.ts
var import_core20 = require("@keystone-6/core");
var import_fields21 = require("@keystone-6/core/fields");
var MessageTemplate = (0, import_core20.list)({
  access: {
    operation: {
      query: permissions.canManageClients,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields21.text)({
      validation: { isRequired: true },
      ui: {
        description: "Template name for identification"
      }
    }),
    type: (0, import_fields21.select)({
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
    content: (0, import_fields21.text)({
      validation: { isRequired: true },
      ui: {
        displayMode: "textarea",
        description: "Message content with variables like {{clientName}}, {{appointmentDate}}, {{stylistName}}"
      }
    }),
    variables: (0, import_fields21.json)({
      ui: {
        description: 'Available variables for this template, e.g., ["clientName", "appointmentDate", "stylistName"]'
      }
    }),
    isActive: (0, import_fields21.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this template is currently active and available for use"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/MessageLog.ts
var import_core21 = require("@keystone-6/core");
var import_fields22 = require("@keystone-6/core/fields");
var MessageLog = (0, import_core21.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients
    },
    filter: {
      query: rules.canReadMessageLogs
    }
  },
  ui: {
    listView: {
      initialColumns: ["recipient", "template", "sentAt", "channel", "status"]
    }
  },
  fields: {
    // Recipient of the message
    recipient: (0, import_fields22.relationship)({
      ref: "User.messageLogs",
      ui: {
        displayMode: "select",
        description: "User who received this message"
      }
    }),
    // Template used for this message
    template: (0, import_fields22.relationship)({
      ref: "MessageTemplate",
      ui: {
        displayMode: "select",
        description: "Message template used"
      }
    }),
    sentAt: (0, import_fields22.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the message was sent"
      }
    }),
    channel: (0, import_fields22.select)({
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
    status: (0, import_fields22.select)({
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
    errorMessage: (0, import_fields22.text)({
      ui: {
        displayMode: "textarea",
        description: "Error details if the message failed to deliver"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/GiftCard.ts
var import_core22 = require("@keystone-6/core");
var import_fields23 = require("@keystone-6/core/fields");
var GiftCard = (0, import_core22.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadGiftCards
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["code", "initialValue", "currentBalance", "recipientName", "isActive", "expiresAt"]
    }
  },
  fields: {
    // Unique gift card code
    code: (0, import_fields23.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Unique gift card code for redemption"
      }
    }),
    // Value fields
    initialValue: (0, import_fields23.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Original value of the gift card when purchased"
      }
    }),
    currentBalance: (0, import_fields23.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Current remaining balance on the gift card"
      }
    }),
    // Recipient information
    recipientEmail: (0, import_fields23.text)({
      ui: {
        description: "Email address of the gift card recipient"
      }
    }),
    recipientName: (0, import_fields23.text)({
      ui: {
        description: "Name of the gift card recipient"
      }
    }),
    // Personal message
    message: (0, import_fields23.text)({
      ui: {
        displayMode: "textarea",
        description: "Personal message from purchaser to recipient"
      }
    }),
    // Expiration and status
    expiresAt: (0, import_fields23.timestamp)({
      ui: {
        description: "Expiration date of the gift card"
      }
    }),
    isActive: (0, import_fields23.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether the gift card is currently active and can be redeemed"
      }
    }),
    // Timestamps
    // Relationships
    purchasedBy: (0, import_fields23.relationship)({
      ref: "User.purchasedGiftCards",
      ui: {
        displayMode: "select",
        description: "User who purchased this gift card"
      }
    }),
    // Transactions on this gift card
    transactions: (0, import_fields23.relationship)({
      ref: "GiftCardTransaction.giftCard",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["amount", "type", "createdAt"],
        description: "Transaction history for this gift card"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/GiftCardTransaction.ts
var import_core23 = require("@keystone-6/core");
var import_fields24 = require("@keystone-6/core/fields");
var GiftCardTransaction = (0, import_core23.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadGiftCardTransactions
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["giftCard", "amount", "type", "createdAt"]
    }
  },
  fields: {
    // Transaction amount
    amount: (0, import_fields24.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Transaction amount (positive for purchase/refund, negative for redemption)"
      }
    }),
    // Transaction type
    type: (0, import_fields24.select)({
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
    idempotencyKey: (0, import_fields24.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Workflow idempotency key that produced this immutable balance event"
      }
    }),
    // Notes
    notes: (0, import_fields24.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes about this transaction"
      }
    }),
    // Relationships
    giftCard: (0, import_fields24.relationship)({
      ref: "GiftCard.transactions",
      ui: {
        displayMode: "select",
        description: "Gift card this transaction belongs to"
      }
    }),
    // Optional appointment (for redemptions)
    appointment: (0, import_fields24.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Appointment this redemption was applied to (if applicable)"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ClientMembership.ts
var import_core24 = require("@keystone-6/core");
var import_fields25 = require("@keystone-6/core/fields");
var ClientMembership = (0, import_core24.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadClientMemberships
    }
  },
  hooks: createLifecycleHooks("client_membership", ["status", "startDate", "nextBillingDate", "pausedUntil", "clientId", "membershipId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["client", "membership", "status", "startDate", "nextBillingDate"]
    }
  },
  fields: {
    // Link to User (client)
    client: (0, import_fields25.relationship)({
      ref: "User.clientMemberships",
      ui: {
        displayMode: "select",
        description: "The client who holds this membership"
      }
    }),
    // Link to Membership plan
    membership: (0, import_fields25.relationship)({
      ref: "Membership",
      ui: {
        displayMode: "select",
        description: "The membership plan"
      }
    }),
    // Membership dates
    startDate: (0, import_fields25.timestamp)({
      validation: { isRequired: true },
      ui: {
        description: "When the membership started"
      }
    }),
    nextBillingDate: (0, import_fields25.timestamp)({
      ui: {
        description: "Next billing date for recurring memberships"
      }
    }),
    // Membership status
    status: (0, import_fields25.select)({
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
    pausedUntil: (0, import_fields25.timestamp)({
      ui: {
        description: "If paused, when the membership will resume"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/IntakeForm.ts
var import_core25 = require("@keystone-6/core");
var import_fields26 = require("@keystone-6/core/fields");
var IntakeForm = (0, import_core25.list)({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      update: permissions.canManageCareRecords,
      delete: () => false
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "isActive", "requiredForServices"]
    }
  },
  fields: {
    name: (0, import_fields26.text)({
      validation: { isRequired: true },
      ui: {
        description: "Form name (e.g., New Client Intake, Color Consultation)"
      }
    }),
    // JSON schema for form fields
    fields: (0, import_fields26.json)({
      ui: {
        description: "JSON schema defining form fields, e.g., [{name: 'allergies', type: 'text', required: true}, {name: 'hairGoals', type: 'textarea'}]"
      }
    }),
    // Services that require this form
    requiredForServices: (0, import_fields26.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "select",
        description: "Services that require this intake form to be completed"
      }
    }),
    // Whether the form is currently active
    isActive: (0, import_fields26.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this form is currently in use"
      }
    }),
    // Submissions of this form
    submissions: (0, import_fields26.relationship)({
      ref: "FormSubmission.form",
      many: true,
      access: workflowOwned,
      ui: {
        displayMode: "count"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ServicePackage.ts
var import_core26 = require("@keystone-6/core");
var import_fields27 = require("@keystone-6/core/fields");
var ServicePackage = (0, import_core26.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canManageCatalog({ session }) || permissions.canManageClients({ session }),
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "totalPrice", "savingsAmount", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields27.text)({
      validation: { isRequired: true },
      ui: {
        description: "Package name (e.g., Bridal Package, Spa Day Package)"
      }
    }),
    description: (0, import_fields27.text)({
      ui: {
        displayMode: "textarea",
        description: "Detailed description of what's included in the package"
      }
    }),
    totalPrice: (0, import_fields27.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Total package price"
      }
    }),
    savingsAmount: (0, import_fields27.integer)({
      defaultValue: 0,
      ui: {
        description: "Amount saved compared to booking services individually"
      }
    }),
    validDays: (0, import_fields27.integer)({
      defaultValue: 30,
      ui: {
        description: "Number of days the package is valid after purchase"
      }
    }),
    isActive: (0, import_fields27.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this package is currently available for purchase"
      }
    }),
    // Relationships
    services: (0, import_fields27.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included in this package"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Membership.ts
var import_core27 = require("@keystone-6/core");
var import_fields28 = require("@keystone-6/core/fields");
var Membership = (0, import_core27.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog
    },
    filter: {
      query: ({ session }) => permissions.canManageCatalog({ session }) ? true : { isActive: { equals: true } }
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "monthlyPrice", "discountPercent", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields28.text)({
      validation: { isRequired: true },
      ui: {
        description: "Membership tier name (e.g., Bronze, Silver, Gold, Platinum)"
      }
    }),
    description: (0, import_fields28.text)({
      ui: {
        displayMode: "textarea",
        description: "Description of membership benefits and perks"
      }
    }),
    monthlyPrice: (0, import_fields28.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Monthly membership fee"
      }
    }),
    discountPercent: (0, import_fields28.integer)({
      defaultValue: 0,
      validation: { min: 0, max: 100 },
      ui: {
        description: "Percentage discount on services (0-100)"
      }
    }),
    isActive: (0, import_fields28.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this membership is currently available"
      }
    }),
    // Relationships
    includedServices: (0, import_fields28.relationship)({
      ref: "Service",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "basePrice", "baseDuration"],
        inlineConnect: true,
        description: "Services included for free or at a discount with this membership"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/FormSubmission.ts
var import_core28 = require("@keystone-6/core");
var import_fields29 = require("@keystone-6/core/fields");
var FormSubmission = (0, import_core28.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCareRecords,
      // Submitted consultation evidence is append-only. Corrections create a
      // new submission rather than rewriting or deleting what was signed.
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadFormSubmissions
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "form", "submittedAt", "appointment"]
    }
  },
  fields: {
    // Form data stored as JSON
    data: (0, import_fields29.json)({
      ui: {
        description: "Form field responses as JSON object"
      }
    }),
    // Digital signature
    signature: (0, import_fields29.text)({
      ui: {
        displayMode: "textarea",
        description: "Client's digital signature (base64 encoded or signature data)"
      }
    }),
    // Submission timestamp
    submittedAt: (0, import_fields29.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the form was submitted"
      }
    }),
    // Relationships
    client: (0, import_fields29.relationship)({
      ref: "User.formSubmissions",
      ui: {
        displayMode: "select",
        description: "Client who submitted the form"
      }
    }),
    form: (0, import_fields29.relationship)({
      ref: "IntakeForm.submissions",
      ui: {
        displayMode: "select",
        description: "The intake form template that was filled out (legacy)"
      }
    }),
    template: (0, import_fields29.relationship)({
      ref: "FormTemplate.submissions",
      ui: {
        displayMode: "select",
        description: "The form template that was filled out"
      }
    }),
    // Optional link to appointment
    appointment: (0, import_fields29.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (if applicable)"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/FormTemplate.ts
var import_core29 = require("@keystone-6/core");
var import_fields30 = require("@keystone-6/core/fields");
var FormTemplate = (0, import_core29.list)({
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: permissions.canManageCareRecords,
      update: permissions.canManageCareRecords,
      delete: () => false
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "type", "isActive", "requiredForCategories"]
    }
  },
  fields: {
    name: (0, import_fields30.text)({
      validation: { isRequired: true },
      ui: {
        description: "Form name (e.g., New Client Intake, Color Service Consent)"
      }
    }),
    type: (0, import_fields30.select)({
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
    description: (0, import_fields30.text)({
      ui: {
        displayMode: "textarea",
        description: "Description of the form's purpose"
      }
    }),
    fields: (0, import_fields30.json)({
      ui: {
        description: `JSON array of field definitions: [{id, type (text/textarea/checkbox/radio/select/signature/file), label, required, options (for select/radio), validation}]`
      }
    }),
    isActive: (0, import_fields30.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this form is currently active"
      }
    }),
    requiredForCategories: (0, import_fields30.relationship)({
      ref: "ServiceCategory",
      many: true,
      ui: {
        displayMode: "select",
        description: "Service categories that require this form"
      }
    }),
    versions: (0, import_fields30.relationship)({ ref: "ConsultationTemplateVersion.template", many: true, access: workflowOwned }),
    submissions: (0, import_fields30.relationship)({
      ref: "FormSubmission.template",
      many: true,
      access: workflowOwned,
      ui: {
        displayMode: "count"
      }
    }),
    metadata: (0, import_fields30.json)({
      ui: {
        description: "Additional form metadata"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/LoyaltyProgram.ts
var import_core30 = require("@keystone-6/core");
var import_fields31 = require("@keystone-6/core/fields");
var LoyaltyProgram = (0, import_core30.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: permissions.canManageCatalog,
      delete: permissions.canManageCatalog
    },
    filter: {
      query: ({ session }) => permissions.canManageCatalog({ session }) ? true : { isActive: { equals: true } }
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "pointsPerDollar", "redemptionRate", "isActive"]
    }
  },
  fields: {
    // Program name
    name: (0, import_fields31.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the loyalty program"
      }
    }),
    // Points configuration
    pointsPerDollar: (0, import_fields31.float)({
      validation: { isRequired: true },
      defaultValue: 1,
      ui: {
        description: "Number of points earned per dollar spent"
      }
    }),
    redemptionRate: (0, import_fields31.float)({
      validation: { isRequired: true },
      defaultValue: 0.01,
      ui: {
        description: "Dollar value per point when redeeming (e.g., 0.01 = 1 cent per point)"
      }
    }),
    // Tier configuration stored as JSON array
    // Example: [{ name: "Bronze", minPoints: 0, benefits: ["5% off"] }, { name: "Gold", minPoints: 1000, benefits: ["10% off", "Free shipping"] }]
    tiers: (0, import_fields31.json)({
      ui: {
        description: "Tier configuration as JSON array with name, minPoints, and benefits for each tier"
      }
    }),
    // Program status
    isActive: (0, import_fields31.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this loyalty program is currently active"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/WaitlistEntry.ts
var import_core31 = require("@keystone-6/core");
var import_fields32 = require("@keystone-6/core/fields");
var WaitlistEntry = (0, import_core31.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canManageAppointments({ session }) || permissions.canManageClients({ session }),
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["client", "service", "isActive", "dateRangeStart", "dateRangeEnd"]
    }
  },
  fields: {
    // Client requesting the appointment
    client: (0, import_fields32.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Client waiting for an appointment"
      }
    }),
    guestName: (0, import_fields32.text)({
      ui: { description: "Walk-in name when no client account is connected" }
    }),
    guestPhone: (0, import_fields32.text)({
      ui: { description: "Walk-in contact number when no client account is connected" }
    }),
    // Service they want to book
    service: (0, import_fields32.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service the client wants to book"
      }
    }),
    // Preferred stylists (many-to-many)
    preferredStylists: (0, import_fields32.relationship)({
      ref: "Stylist.waitlistEntries",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["user", "tier"],
        description: "Stylists the client would prefer"
      }
    }),
    // Preferred days of the week
    preferredDays: (0, import_fields32.json)({
      ui: {
        description: 'Preferred days of week as JSON array, e.g., ["monday", "wednesday", "friday"]'
      }
    }),
    // Preferred time range
    preferredTimeRange: (0, import_fields32.text)({
      ui: {
        description: 'Preferred time range, e.g., "9:00-12:00" or "morning" or "afternoon"'
      }
    }),
    // Date range the client is available
    dateRangeStart: (0, import_fields32.timestamp)({
      ui: {
        description: "Start of date range the client is available"
      }
    }),
    dateRangeEnd: (0, import_fields32.timestamp)({
      ui: {
        description: "End of date range the client is available"
      }
    }),
    // Workflow state
    status: (0, import_fields32.select)({
      type: "string",
      defaultValue: "active",
      validation: { isRequired: true },
      options: [
        { label: "Active", value: "active" },
        { label: "Notified", value: "notified" },
        { label: "Converted", value: "converted" },
        { label: "Removed", value: "removed" }
      ]
    }),
    isActive: (0, import_fields32.checkbox)({
      defaultValue: true,
      ui: {
        description: "Compatibility flag maintained by the waitlist workflow"
      }
    }),
    requestKey: (0, import_fields32.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Idempotency key used to join the waitlist"
      }
    }),
    // When the client was notified of availability
    notifiedAt: (0, import_fields32.timestamp)({
      ui: {
        description: "When the client was notified that a slot became available"
      }
    }),
    transitionedAt: (0, import_fields32.timestamp)({
      ui: {
        description: "When the latest controlled transition occurred"
      }
    }),
    transitionReason: (0, import_fields32.text)({
      ui: {
        displayMode: "textarea",
        description: "Reason recorded by the latest controlled transition"
      }
    }),
    convertedAppointment: (0, import_fields32.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Appointment created from this waitlist entry"
      }
    }),
    // Notes
    notes: (0, import_fields32.text)({
      ui: {
        displayMode: "textarea",
        description: "Additional notes or special requests"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/WidgetConfiguration.ts
var import_core32 = require("@keystone-6/core");
var import_fields33 = require("@keystone-6/core/fields");
var WidgetConfiguration = (0, import_core32.list)({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      create: permissions.canManageIntegrations,
      update: permissions.canManageIntegrations,
      delete: permissions.canManageIntegrations
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "primaryColor", "showServices", "showStylists"]
    }
  },
  fields: {
    // Widget name/identifier
    name: (0, import_fields33.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Unique name for this widget configuration"
      }
    }),
    // Branding colors
    primaryColor: (0, import_fields33.text)({
      defaultValue: "#000000",
      ui: {
        description: "Primary brand color in hex format (e.g., #FF5733)"
      }
    }),
    secondaryColor: (0, import_fields33.text)({
      defaultValue: "#FFFFFF",
      ui: {
        description: "Secondary brand color in hex format (e.g., #333333)"
      }
    }),
    // Logo
    logoUrl: (0, import_fields33.text)({
      ui: {
        description: "URL to the salon logo for the widget"
      }
    }),
    // Display options
    showServices: (0, import_fields33.checkbox)({
      defaultValue: true,
      ui: {
        description: "Show service selection in the booking widget"
      }
    }),
    showStylists: (0, import_fields33.checkbox)({
      defaultValue: true,
      ui: {
        description: "Show stylist selection in the booking widget"
      }
    }),
    // Custom styling
    customCSS: (0, import_fields33.text)({
      ui: {
        displayMode: "textarea",
        description: "Custom CSS to override widget styles"
      }
    }),
    // Embed code (generated)
    embedCode: (0, import_fields33.text)({
      ui: {
        displayMode: "textarea",
        description: "Generated embed code for external websites"
      }
    }),
    // Additional settings
    buttonText: (0, import_fields33.text)({
      defaultValue: "Book Now",
      ui: {
        description: "Text displayed on the booking button"
      }
    }),
    welcomeMessage: (0, import_fields33.text)({
      ui: {
        displayMode: "textarea",
        description: "Welcome message displayed in the widget"
      }
    }),
    // Widget dimensions
    width: (0, import_fields33.text)({
      defaultValue: "100%",
      ui: {
        description: "Widget width (e.g., 400px, 100%)"
      }
    }),
    height: (0, import_fields33.text)({
      defaultValue: "600px",
      ui: {
        description: "Widget height (e.g., 600px, auto)"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Location.ts
var import_core33 = require("@keystone-6/core");
var import_fields34 = require("@keystone-6/core/fields");
var Location = (0, import_core33.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageSalon({ session }) ? true : { isActive: { equals: true } }
    }
  },
  hooks: createLifecycleHooks("location", ["name", "city", "state", "timezone", "isActive"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "city", "state", "phone", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields34.text)({
      validation: { isRequired: true },
      ui: {
        description: "Location/branch name"
      }
    }),
    address: (0, import_fields34.text)({
      validation: { isRequired: true },
      ui: {
        description: "Street address"
      }
    }),
    city: (0, import_fields34.text)({
      validation: { isRequired: true },
      ui: {
        description: "City"
      }
    }),
    state: (0, import_fields34.text)({
      validation: { isRequired: true },
      ui: {
        description: "State/Province"
      }
    }),
    zipCode: (0, import_fields34.text)({
      validation: { isRequired: true },
      ui: {
        description: "ZIP/Postal code"
      }
    }),
    phone: (0, import_fields34.text)({
      ui: {
        description: "Contact phone number"
      }
    }),
    email: (0, import_fields34.text)({
      ui: {
        description: "Contact email address"
      }
    }),
    hours: (0, import_fields34.json)({
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
    timezone: (0, import_fields34.text)({
      defaultValue: "America/New_York",
      ui: {
        description: "Timezone for this location (e.g., America/New_York)"
      }
    }),
    isActive: (0, import_fields34.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this location is currently active and accepting appointments"
      }
    }),
    resources: (0, import_fields34.relationship)({
      ref: "SalonResource.location",
      many: true,
      ui: {
        displayMode: "count",
        description: "Rooms, chairs, stations, and equipment at this location"
      }
    }),
    stylists: (0, import_fields34.relationship)({ ref: "Stylist.locations", many: true }),
    clients: (0, import_fields34.relationship)({ ref: "Client.homeLocation", many: true }),
    appointments: (0, import_fields34.relationship)({ ref: "Appointment.location", many: true }),
    schedules: (0, import_fields34.relationship)({ ref: "StylistSchedule.location", many: true }),
    inventoryMovements: (0, import_fields34.relationship)({ ref: "InventoryMovement.location", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/StoreSettings.ts
var import_core34 = require("@keystone-6/core");
var import_fields35 = require("@keystone-6/core/fields");

// features/lib/sanitize-store-logo.ts
var ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "path",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc"
]);
var ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
  "xmlns",
  "fill",
  "fill-rule",
  "clip-rule",
  "height",
  "width",
  "viewbox",
  "d",
  "clip-path",
  "id",
  "x1",
  "x2",
  "y1",
  "y2",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "opacity",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "transform",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "role",
  "aria-hidden",
  "aria-label",
  "preserveaspectratio"
]);
var ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
var TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) return "";
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) return "";
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}

// features/lib/store-logo.ts
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(numeric)) return "0";
  return String((numeric % 360 + 360) % 360);
}

// features/lib/storefront-theme.ts
var STOREFRONT_HUE_MIN = 0;
var STOREFRONT_HUE_MAX = 359;
var UNCONFIGURED_STOREFRONT_HUE = 0;
function isValidStorefrontHue(value) {
  return Number.isInteger(value) && Number(value) >= STOREFRONT_HUE_MIN && Number(value) <= STOREFRONT_HUE_MAX;
}
function parseStorefrontHue(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!isValidStorefrontHue(numeric)) {
    throw new Error(`Theme hue must be an integer from ${STOREFRONT_HUE_MIN} to ${STOREFRONT_HUE_MAX}`);
  }
  return numeric;
}
function safeStorefrontHue(value) {
  try {
    return parseStorefrontHue(value);
  } catch {
    return UNCONFIGURED_STOREFRONT_HUE;
  }
}

// features/keystone/models/StoreSettings.ts
var STOREFRONT_SETTINGS_SCOPE = "storefront";
var StoreSettings = (0, import_core34.list)({
  access: {
    operation: {
      query: permissions.canManageSalon,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  isSingleton: true,
  graphql: { plural: "storeSettingsItems" },
  ui: {
    hideCreate: true,
    hideDelete: true,
    isHidden: true,
    listView: {
      initialColumns: ["name", "primaryLocation", "themeHue"]
    }
  },
  fields: {
    scope: (0, import_fields35.text)({
      defaultValue: STOREFRONT_SETTINGS_SCOPE,
      isIndexed: "unique",
      validation: { isRequired: true, length: { max: 40 } },
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } }
    }),
    name: (0, import_fields35.text)({
      validation: { isRequired: true, length: { max: 120 } },
      ui: { description: "Public storefront name" }
    }),
    description: (0, import_fields35.text)({
      validation: { length: { max: 240 } },
      ui: { displayMode: "textarea", description: "Short public storefront description" }
    }),
    themeHue: (0, import_fields35.integer)({
      validation: { isRequired: true, min: STOREFRONT_HUE_MIN, max: STOREFRONT_HUE_MAX },
      ui: { description: "Public storefront theme hue from 0 through 359" }
    }),
    logoIcon: (0, import_fields35.text)({
      defaultValue: "",
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return typeof value === "string" ? sanitizeStoreLogoSvg(value) : value;
        },
        validate: ({ inputData, fieldKey, addValidationError }) => {
          const value = inputData?.[fieldKey];
          if (value && (typeof value !== "string" || !sanitizeStoreLogoSvg(value))) addValidationError("Logo must be a valid, safe SVG document");
        }
      }
    }),
    logoColor: (0, import_fields35.text)({
      defaultValue: "0",
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => {
        const value = resolvedData[fieldKey];
        return value === void 0 ? value : normalizeStoreLogoColor(value);
      } }
    }),
    primaryLocation: (0, import_fields35.relationship)({
      ref: "Location",
      many: false,
      ui: { displayMode: "select", labelField: "name", hideCreate: true }
    }),
    ...trackingFields
  }
});

// features/keystone/models/SalonResource.ts
var import_core35 = require("@keystone-6/core");
var import_fields36 = require("@keystone-6/core/fields");
var SalonResource = (0, import_core35.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canManageResources({ session }) || permissions.canManageAppointments({ session }),
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  hooks: createLifecycleHooks("salon_resource", ["name", "type", "capacity", "isActive", "revision", "locationId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "type", "location", "capacity", "isActive"]
    },
    labelField: "name"
  },
  fields: {
    name: (0, import_fields36.text)({
      validation: { isRequired: true },
      ui: {
        description: "Resource name (e.g., Color Bar 1, Treatment Room A, Shampoo Bowl 2)"
      }
    }),
    type: (0, import_fields36.select)({
      type: "enum",
      options: [
        { label: "Chair / Station", value: "station" },
        { label: "Treatment Room", value: "room" },
        { label: "Shampoo Bowl", value: "shampoo_bowl" },
        { label: "Equipment", value: "equipment" },
        { label: "Color Bar", value: "color_bar" },
        { label: "Other", value: "other" }
      ],
      defaultValue: "station",
      validation: { isRequired: true },
      ui: {
        description: "The kind of physical resource required to deliver services"
      }
    }),
    revision: (0, import_fields36.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    capacity: (0, import_fields36.integer)({
      defaultValue: 1,
      ui: {
        description: "How many simultaneous appointments this resource can support"
      }
    }),
    isActive: (0, import_fields36.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this resource can currently be booked"
      }
    }),
    notes: (0, import_fields36.text)({
      ui: {
        displayMode: "textarea",
        description: "Operational notes, setup constraints, or room/equipment details"
      }
    }),
    metadata: (0, import_fields36.json)({
      ui: {
        description: "Additional resource metadata such as cleanup buffer, equipment tags, or setup rules"
      }
    }),
    location: (0, import_fields36.relationship)({
      ref: "Location.resources",
      ui: {
        displayMode: "select"
      }
    }),
    services: (0, import_fields36.relationship)({
      ref: "Service.requiredResources",
      many: true,
      ui: {
        displayMode: "count",
        description: "Services that can use this resource"
      }
    }),
    segmentDefinitions: (0, import_fields36.relationship)({ ref: "ServiceSegment.eligibleResources", many: true }),
    appointmentSegments: (0, import_fields36.relationship)({ ref: "AppointmentSegment.resource", many: true }),
    appointments: (0, import_fields36.relationship)({
      ref: "Appointment.resource",
      many: true,
      ui: {
        displayMode: "count"
      }
    }),
    activeAppointmentCount: (0, import_fields36.virtual)({
      field: import_core35.graphql.field({
        type: import_core35.graphql.Int,
        async resolve(item, args, context) {
          const resourceId = item.id;
          return context.sudo().query.Appointment.count({
            where: {
              resource: { id: { equals: resourceId } },
              status: { in: ["pending", "confirmed", "in_progress"] }
            }
          });
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/Product.ts
var import_core36 = require("@keystone-6/core");
var import_fields37 = require("@keystone-6/core/fields");
var Product = (0, import_core36.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: ({ session }) => permissions.canManageInventory({ session }) || permissions.canManageCatalog({ session }) ? true : { isActive: { equals: true } }
    }
  },
  hooks: createLifecycleHooks("product", ["name", "sku", "price", "cost", "quantity", "reorderPoint", "isActive"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["name", "sku", "price", "quantity", "category", "isActive"]
    }
  },
  fields: {
    name: (0, import_fields37.text)({
      validation: { isRequired: true },
      ui: {
        description: "Product name"
      }
    }),
    sku: (0, import_fields37.text)({
      isIndexed: "unique",
      ui: {
        description: "Stock Keeping Unit - unique product identifier"
      }
    }),
    price: (0, import_fields37.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Retail price"
      }
    }),
    cost: (0, import_fields37.integer)({
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }) },
      ui: {
        description: "Wholesale/cost price for profit tracking"
      }
    }),
    quantity: (0, import_fields37.integer)({
      label: "Aggregate stock units across locations",
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canManagePayments({ session }) },
      defaultValue: 0,
      ui: {
        description: "Total stock units across all locations; not a location-specific sellable balance"
      }
    }),
    reorderPoint: (0, import_fields37.integer)({
      label: "Aggregate reorder alert quantity",
      access: { read: permissions.canManageInventory },
      defaultValue: 5,
      ui: {
        description: "Threshold evaluated against aggregate stock across locations"
      }
    }),
    category: (0, import_fields37.text)({
      ui: {
        description: "Product category (e.g., Shampoo, Conditioner, Styling, Color)"
      }
    }),
    description: (0, import_fields37.text)({
      ui: {
        displayMode: "textarea",
        description: "Product description"
      }
    }),
    image: (0, import_fields37.relationship)({
      ref: "SalonImage",
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText"],
        inlineCreate: { fields: ["image", "altText"] },
        inlineEdit: { fields: ["image", "altText"] }
      }
    }),
    isActive: (0, import_fields37.checkbox)({
      defaultValue: true,
      ui: {
        description: "Whether this product is available for sale"
      }
    }),
    inventoryMovements: (0, import_fields37.relationship)({
      ref: "InventoryMovement.product",
      many: true,
      access: { read: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }) }
    }),
    ...trackingFields
  }
});

// features/keystone/models/ProductSale.ts
var import_core37 = require("@keystone-6/core");
var import_fields38 = require("@keystone-6/core/fields");
var ProductSale = (0, import_core37.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadProductSales
    }
  },
  hooks: createLifecycleHooks("product_sale", ["total", "soldAt", "appointmentId", "soldById"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["soldAt", "total", "soldBy", "appointment"]
    }
  },
  fields: {
    // Optional link to appointment (for retail sales during service)
    appointment: (0, import_fields38.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional - for sales during service visits)"
      }
    }),
    // Products sold in this transaction
    products: (0, import_fields38.json)({
      defaultValue: [],
      ui: {
        description: "Array of products sold: [{ productId, name, quantity, price, subtotal }]"
      }
    }),
    total: (0, import_fields38.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount"
      }
    }),
    // Staff member who made the sale
    soldBy: (0, import_fields38.relationship)({
      ref: "User",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the sale"
      }
    }),
    soldAt: (0, import_fields38.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the sale occurred"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Commission.ts
var import_core38 = require("@keystone-6/core");
var import_fields39 = require("@keystone-6/core/fields");
var Commission = (0, import_core38.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadCommissions
    }
  },
  hooks: createLifecycleHooks("commission", ["saleAmount", "commissionRate", "commissionAmount", "isPaid", "paidAt", "stylistId", "serviceId", "paymentId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["stylist", "payment", "saleAmount", "commissionRate", "commissionAmount", "isPaid"]
    }
  },
  fields: {
    // Commission calculation fields
    saleAmount: (0, import_fields39.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Total sale amount for this service"
      }
    }),
    commissionRate: (0, import_fields39.float)({
      validation: { isRequired: true, min: 0, max: 1 },
      ui: {
        description: "Commission rate applied (e.g., 0.5 for 50%)"
      }
    }),
    commissionAmount: (0, import_fields39.integer)({
      validation: { isRequired: true },
      ui: {
        description: "Calculated commission amount (saleAmount * commissionRate)"
      }
    }),
    // Payment status
    isPaid: (0, import_fields39.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this commission has been paid to the stylist"
      }
    }),
    paidAt: (0, import_fields39.timestamp)({
      ui: {
        description: "When the commission was paid to the stylist"
      }
    }),
    // Notes
    notes: (0, import_fields39.text)({
      ui: {
        displayMode: "textarea",
        description: "Notes about this commission"
      }
    }),
    // Relationships
    stylist: (0, import_fields39.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Stylist who earned this commission"
      }
    }),
    service: (0, import_fields39.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service that generated this commission"
      }
    }),
    adjustments: (0, import_fields39.relationship)({ ref: "CommissionAdjustment.commission", many: true }),
    payment: (0, import_fields39.relationship)({
      ref: "Payment",
      ui: {
        displayMode: "select",
        description: "Payment associated with this commission"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/Review.ts
var import_core39 = require("@keystone-6/core");
var import_fields40 = require("@keystone-6/core/fields");
var Review = (0, import_core39.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageClients,
      update: permissions.canManageClients,
      delete: permissions.canManageClients
    },
    filter: {
      query: ({ session }) => permissions.canManageClients({ session }) ? true : { isApproved: { equals: true } }
    }
  },
  ui: {
    listView: {
      initialColumns: ["client", "rating", "service", "stylist", "isApproved", "createdAt"]
    }
  },
  fields: {
    // Rating (1-5 stars)
    rating: (0, import_fields40.integer)({
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
    comment: (0, import_fields40.text)({
      ui: {
        displayMode: "textarea",
        description: "Review comment from the client"
      }
    }),
    // Moderation
    isApproved: (0, import_fields40.checkbox)({
      defaultValue: false,
      ui: {
        description: "Whether this review has been approved to display publicly"
      }
    }),
    // Timestamps
    // Relationships
    client: (0, import_fields40.relationship)({
      ref: "Client.reviews",
      ui: {
        displayMode: "select",
        description: "Client who wrote this review"
      }
    }),
    service: (0, import_fields40.relationship)({
      ref: "Service.reviews",
      ui: {
        displayMode: "select",
        description: "Service being reviewed"
      }
    }),
    stylist: (0, import_fields40.relationship)({
      ref: "Stylist.reviews",
      ui: {
        displayMode: "select",
        description: "Stylist being reviewed"
      }
    }),
    appointment: (0, import_fields40.relationship)({
      ref: "Appointment.review",
      ui: {
        displayMode: "select",
        description: "Associated appointment (optional)"
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/SalonTransaction.ts
var import_core40 = require("@keystone-6/core");
var import_fields41 = require("@keystone-6/core/fields");

// features/keystone/transactionReceipt.ts
function cents(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function transactionReceiptTotals(transaction) {
  const metadata = transaction.metadata && typeof transaction.metadata === "object" ? transaction.metadata : {};
  if (metadata.source === "controlled_checkout") {
    return {
      subtotal: cents(metadata.subtotal),
      tax: cents(metadata.tax),
      discount: cents(metadata.discount),
      total: cents(metadata.total)
    };
  }
  const lines = transaction.lineItems || [];
  return {
    subtotal: lines.reduce((sum, line) => sum + (cents(line.unitPrice) || 0) * (cents(line.quantity) ?? 1), 0),
    tax: cents(transaction.payment?.tax),
    discount: lines.reduce((sum, line) => sum + (cents(line.discount) || 0), 0),
    total: cents(transaction.payment?.totalAmount)
  };
}

// features/keystone/models/SalonTransaction.ts
var formatCurrency4 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var SalonTransaction = (0, import_core40.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadSalonTransactions
    }
  },
  hooks: createLifecycleHooks("salon_transaction", ["type", "tip", "paymentMethod", "paymentStatus", "status", "completedAt", "locationId", "clientId", "appointmentId", "staffId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["type", "client", "staff", "total", "paymentStatus", "status"]
    }
  },
  fields: {
    type: (0, import_fields41.select)({
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
    location: (0, import_fields41.relationship)({ ref: "Location" }),
    client: (0, import_fields41.relationship)({
      ref: "Client",
      ui: {
        displayMode: "select",
        description: "Client (optional for walk-ins)"
      }
    }),
    appointment: (0, import_fields41.relationship)({
      ref: "Appointment.transaction",
      ui: {
        displayMode: "select",
        description: "Appointment being checked out"
      }
    }),
    staff: (0, import_fields41.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who processed the transaction"
      }
    }),
    reversals: (0, import_fields41.relationship)({ ref: "TransactionReversal.transaction", many: true }),
    lineItems: (0, import_fields41.relationship)({
      ref: "SalonTransactionLineItem.transaction",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["itemType", "service", "product", "formattedTotal"]
      }
    }),
    tip: (0, import_fields41.integer)({
      defaultValue: 0,
      ui: {
        description: "Tip amount in cents"
      }
    }),
    paymentMethod: (0, import_fields41.select)({
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
    paymentStatus: (0, import_fields41.select)({
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
    status: (0, import_fields41.select)({
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
    metadata: (0, import_fields41.json)({
      ui: {
        description: "Additional transaction metadata"
      }
    }),
    completedAt: (0, import_fields41.timestamp)({
      ui: {
        description: "When the transaction was completed"
      }
    }),
    ...(0, import_core40.group)({
      label: "Virtual Fields",
      description: "Calculated fields for transaction totals",
      fields: {
        subtotal: (0, import_fields41.virtual)({
          field: import_core40.graphql.field({
            type: import_core40.graphql.String,
            async resolve(item, args, context) {
              const transactionId = item.id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata lineItems { quantity unitPrice discount } appointment { payment { tax totalAmount } }"
              });
              const subtotal = transactionReceiptTotals(transaction || {}).subtotal;
              return subtotal === null ? null : formatCurrency4(subtotal);
            }
          })
        }),
        tax: (0, import_fields41.virtual)({
          field: import_core40.graphql.field({
            type: import_core40.graphql.String,
            async resolve(item, args, context) {
              const transactionId = item.id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata appointment { payment { tax totalAmount } }"
              });
              const tax = transactionReceiptTotals(transaction || {}).tax;
              return tax === null ? null : formatCurrency4(tax);
            }
          })
        }),
        discount: (0, import_fields41.virtual)({
          field: import_core40.graphql.field({
            type: import_core40.graphql.String,
            async resolve(item, args, context) {
              const transactionId = item.id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata lineItems { quantity unitPrice discount } appointment { payment { tax totalAmount } }"
              });
              const discount = transactionReceiptTotals(transaction || {}).discount;
              return discount === null ? null : formatCurrency4(discount);
            }
          })
        }),
        total: (0, import_fields41.virtual)({
          field: import_core40.graphql.field({
            type: import_core40.graphql.String,
            async resolve(item, args, context) {
              const transactionId = item.id;
              const transaction = await context.sudo().query.SalonTransaction.findOne({
                where: { id: transactionId },
                query: "metadata appointment { payment { tax totalAmount } }"
              });
              const total = transactionReceiptTotals(transaction || {}).total;
              return total === null ? null : formatCurrency4(total);
            }
          })
        })
      }
    }),
    ...trackingFields
  }
});

// features/keystone/models/SalonTransactionLineItem.ts
var import_core41 = require("@keystone-6/core");
var import_fields42 = require("@keystone-6/core/fields");
var formatCurrency5 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var SalonTransactionLineItem = (0, import_core41.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadSalonTransactionLineItems
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["transaction", "itemType", "service", "product", "staff", "formattedTotal"]
    }
  },
  fields: {
    reversalLines: (0, import_fields42.relationship)({ ref: "TransactionReversalLine.sourceLine", many: true }),
    transaction: (0, import_fields42.relationship)({
      ref: "SalonTransaction.lineItems",
      ui: {
        displayMode: "select",
        description: "Related transaction"
      }
    }),
    itemType: (0, import_fields42.select)({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Product", value: "product" }
      ],
      validation: {
        isRequired: true
      }
    }),
    service: (0, import_fields42.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "Service (if itemType is service)"
      }
    }),
    product: (0, import_fields42.relationship)({
      ref: "Product",
      ui: {
        displayMode: "select",
        description: "Product (if itemType is product)"
      }
    }),
    staff: (0, import_fields42.relationship)({
      ref: "Stylist",
      ui: {
        displayMode: "select",
        description: "Staff member who provided the service"
      }
    }),
    quantity: (0, import_fields42.integer)({
      defaultValue: 1,
      validation: {
        isRequired: true
      }
    }),
    unitPrice: (0, import_fields42.integer)({
      validation: {
        isRequired: true
      },
      ui: {
        description: "Price per unit in cents"
      }
    }),
    discount: (0, import_fields42.integer)({
      defaultValue: 0,
      ui: {
        description: "Discount amount in cents"
      }
    }),
    commissionRate: (0, import_fields42.float)({
      access: { read: compensationRead },
      ui: {
        description: "Commission rate for staff (percentage)"
      }
    }),
    metadata: (0, import_fields42.json)({
      ui: {
        description: "Additional line item metadata"
      }
    }),
    formattedPrice: (0, import_fields42.virtual)({
      field: import_core41.graphql.field({
        type: import_core41.graphql.String,
        async resolve(item, args, context) {
          const lineItemId = item.id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice"
          });
          if (!lineItem?.unitPrice) return "$0.00";
          return formatCurrency5(lineItem.unitPrice);
        }
      })
    }),
    formattedTotal: (0, import_fields42.virtual)({
      field: import_core41.graphql.field({
        type: import_core41.graphql.String,
        async resolve(item, args, context) {
          const lineItemId = item.id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice quantity discount metadata"
          });
          if (!lineItem?.unitPrice || !lineItem?.quantity) return "$0.00";
          const metadata = lineItem.metadata && typeof lineItem.metadata === "object" ? lineItem.metadata : {};
          const packageCredit = typeof metadata.packageCents === "number" && Number.isSafeInteger(metadata.packageCents) && metadata.packageCents >= 0 ? metadata.packageCents : 0;
          const total = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0) - packageCredit;
          return formatCurrency5(total);
        }
      })
    }),
    commissionAmount: (0, import_fields42.virtual)({
      access: { read: compensationRead },
      field: import_core41.graphql.field({
        type: import_core41.graphql.String,
        async resolve(item, args, context) {
          const lineItemId = item.id;
          const lineItem = await context.sudo().query.SalonTransactionLineItem.findOne({
            where: { id: lineItemId },
            query: "unitPrice quantity discount commissionRate"
          });
          if (!lineItem?.unitPrice || !lineItem?.quantity || !lineItem?.commissionRate) {
            return "$0.00";
          }
          const total = lineItem.unitPrice * lineItem.quantity - (lineItem.discount || 0);
          const commission = total * lineItem.commissionRate;
          return formatCurrency5(commission);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/ClientPackage.ts
var import_core42 = require("@keystone-6/core");
var import_fields43 = require("@keystone-6/core/fields");
var formatCurrency6 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var ClientPackage = (0, import_core42.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadClientPackages
    }
  },
  hooks: createLifecycleHooks("client_package", ["status", "totalValue", "paidAmount", "usedValue", "expiresAt", "clientId", "packageId"]),
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["client", "package", "status", "purchasedAt", "expiresAt"]
    }
  },
  fields: {
    client: (0, import_fields43.relationship)({
      ref: "User.clientPackages",
      ui: {
        displayMode: "select",
        description: "Client who purchased the package"
      }
    }),
    package: (0, import_fields43.relationship)({
      ref: "ServicePackage",
      ui: {
        displayMode: "select",
        description: "The service package purchased"
      }
    }),
    purchasedAt: (0, import_fields43.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the package was purchased"
      }
    }),
    expiresAt: (0, import_fields43.timestamp)({
      ui: {
        description: "When the package expires (calculated from validityDays)"
      }
    }),
    status: (0, import_fields43.select)({
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
    totalValue: (0, import_fields43.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Total package value in cents"
      }
    }),
    paidAmount: (0, import_fields43.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Amount paid in cents"
      }
    }),
    usedValue: (0, import_fields43.integer)({
      defaultValue: 0,
      ui: {
        description: "Amount used so far in cents"
      }
    }),
    adjustments: (0, import_fields43.relationship)({ ref: "ClientPackageAdjustment.clientPackage", many: true }),
    usageHistory: (0, import_fields43.relationship)({
      ref: "ClientPackageUsage.clientPackage",
      many: true,
      ui: {
        displayMode: "count",
        description: "Usage history of this package"
      }
    }),
    metadata: (0, import_fields43.json)({
      ui: {
        description: "Additional metadata"
      }
    }),
    remainingValue: (0, import_fields43.virtual)({
      field: import_core42.graphql.field({
        type: import_core42.graphql.Int,
        async resolve(item, args, context) {
          const clientPackageId = item.id;
          const pkg = await context.sudo().query.ClientPackage.findOne({
            where: { id: clientPackageId },
            query: "totalValue usedValue"
          });
          if (!pkg) return 0;
          return (pkg.totalValue || 0) - (pkg.usedValue || 0);
        }
      })
    }),
    formattedRemainingValue: (0, import_fields43.virtual)({
      field: import_core42.graphql.field({
        type: import_core42.graphql.String,
        async resolve(item, args, context) {
          const clientPackageId = item.id;
          const pkg = await context.sudo().query.ClientPackage.findOne({
            where: { id: clientPackageId },
            query: "totalValue usedValue"
          });
          if (!pkg) return "$0.00";
          const remaining = (pkg.totalValue || 0) - (pkg.usedValue || 0);
          return formatCurrency6(remaining);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/ClientPackageUsage.ts
var import_core43 = require("@keystone-6/core");
var import_fields44 = require("@keystone-6/core/fields");
var formatCurrency7 = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount / 100);
};
var ClientPackageUsage = (0, import_core43.list)({
  access: {
    operation: {
      query: () => true,
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: rules.canReadClientPackageUsages
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: {
      initialColumns: ["clientPackage", "service", "quantityUsed", "valueUsed", "usedAt"]
    }
  },
  fields: {
    clientPackage: (0, import_fields44.relationship)({
      ref: "ClientPackage.usageHistory",
      ui: {
        displayMode: "select",
        description: "The client package this usage is for"
      }
    }),
    appointment: (0, import_fields44.relationship)({
      ref: "Appointment",
      ui: {
        displayMode: "select",
        description: "The appointment where this was used"
      }
    }),
    service: (0, import_fields44.relationship)({
      ref: "Service",
      ui: {
        displayMode: "select",
        description: "The service that was used"
      }
    }),
    quantityUsed: (0, import_fields44.integer)({
      defaultValue: 1,
      validation: { min: 1 },
      ui: {
        description: "Number of units used"
      }
    }),
    valueUsed: (0, import_fields44.integer)({
      validation: { isRequired: true, min: 0 },
      ui: {
        description: "Value used in cents"
      }
    }),
    usedAt: (0, import_fields44.timestamp)({
      defaultValue: { kind: "now" },
      ui: {
        description: "When the package was used"
      }
    }),
    idempotencyKey: (0, import_fields44.text)({
      validation: { isRequired: true },
      isIndexed: "unique",
      ui: {
        description: "Workflow idempotency key that produced this immutable usage record"
      }
    }),
    formattedValueUsed: (0, import_fields44.virtual)({
      field: import_core43.graphql.field({
        type: import_core43.graphql.String,
        async resolve(item, args, context) {
          const usageId = item.id;
          const usage = await context.sudo().query.ClientPackageUsage.findOne({
            where: { id: usageId },
            query: "valueUsed"
          });
          if (!usage?.valueUsed) return "$0.00";
          return formatCurrency7(usage.valueUsed);
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/DomainEvent.ts
var import_core44 = require("@keystone-6/core");
var import_fields45 = require("@keystone-6/core/fields");
var DomainEvent = (0, import_core44.list)({
  access: {
    operation: {
      query: permissions.canManageIntegrations,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    listView: { initialColumns: ["eventType", "aggregateType", "aggregateId", "operation", "status", "occurredAt"] }
  },
  fields: {
    eventKey: (0, import_fields45.text)({ validation: { isRequired: true }, isIndexed: "unique", access: { update: () => false } }),
    eventType: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
    eventVersion: (0, import_fields45.integer)({ defaultValue: 1, validation: { isRequired: true, min: 1 }, access: { update: () => false } }),
    aggregateType: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
    aggregateId: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
    operation: (0, import_fields45.select)({
      type: "enum",
      options: [
        { label: "Create", value: "create" },
        { label: "Update", value: "update" },
        { label: "Delete", value: "delete" }
      ],
      validation: { isRequired: true },
      access: { update: () => false }
    }),
    actorId: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
    locationId: (0, import_fields45.text)({ access: { update: () => false } }),
    payload: (0, import_fields45.json)({ access: { update: () => false } }),
    payloadHash: (0, import_fields45.text)({ validation: { isRequired: true }, access: { update: () => false } }),
    occurredAt: (0, import_fields45.timestamp)({ validation: { isRequired: true }, access: { update: () => false } }),
    status: (0, import_fields45.select)({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Delivered", value: "delivered" },
        { label: "Dead letter", value: "dead_letter" }
      ],
      defaultValue: "pending",
      validation: { isRequired: true }
    }),
    attempts: (0, import_fields45.integer)({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    availableAt: (0, import_fields45.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    deliveredAt: (0, import_fields45.timestamp)(),
    lastError: (0, import_fields45.text)({ ui: { displayMode: "textarea" } }),
    ...trackingFields
  }
});

// features/keystone/models/InventoryMovement.ts
var import_core45 = require("@keystone-6/core");
var import_fields46 = require("@keystone-6/core/fields");

// features/keystone/inventory/locationAuthority.ts
var denied = () => new Error("Current stock permission and location assignment could not be verified");
async function currentStockContext(context, purpose) {
  if (!context.session?.itemId || context.session.listKey !== "User") throw denied();
  const actor = await context.query.User.findOne({
    where: { id: context.session.itemId },
    query: "id name role { id name canManageSalon canManageInventory canManagePayments canViewReports canManageOnboarding canIssueRefunds }"
  });
  if (!actor || actor.id !== context.session.itemId || !actor.role) throw denied();
  const session = { ...context.session, data: { ...context.session.data, role: actor.role } };
  const allowed = purpose === "onboarding" ? permissions.canManageOnboarding({ session }) : purpose === "return" ? permissions.canIssueRefunds({ session }) : purpose === "adjust" ? permissions.canManageInventory({ session }) : purpose === "checkout" ? permissions.canManagePayments({ session }) : purpose === "history" ? permissions.canManageInventory({ session }) || permissions.canViewReports({ session }) : permissions.canManageInventory({ session }) || permissions.canManagePayments({ session });
  if (!allowed) throw denied();
  return context.withSession(session);
}
function stockLocationWhere(context) {
  return {
    isActive: { equals: true },
    ...permissions.canManageSalon({ session: context.session }) ? {} : {
      stylists: { some: { user: { id: { equals: context.session.itemId } }, isActive: { equals: true }, status: { equals: "active" } } }
    }
  };
}
async function assertStockLocation(context, locationId, purpose) {
  if (typeof locationId !== "string" || !locationId || locationId.length > 200) throw denied();
  const current = await currentStockContext(context, purpose);
  const locations = await current.query.Location.findMany({
    // Explicit onboarding capability owns new seed opening stock; it does not
    // require a fabricated staff assignment or the ordinary inventory flag.
    where: { AND: [{ id: { equals: locationId } }, purpose === "onboarding" ? { isActive: { equals: true } } : stockLocationWhere(current)] },
    take: 1,
    query: "id name"
  });
  if (locations.length !== 1 || locations[0].id !== locationId || typeof locations[0].name !== "string") throw denied();
  return { context: current, location: { id: locationId, name: locations[0].name } };
}
async function assertCheckoutLocation(context, appointmentId) {
  const current = await currentStockContext(context, "checkout");
  const appointment = await current.query.Appointment.findOne({ where: { id: appointmentId }, query: "id location { id }" });
  if (!appointment || appointment.id !== appointmentId || !appointment.location?.id) throw denied();
  return assertStockLocation(current, appointment.location.id, "checkout");
}

// features/keystone/models/InventoryMovement.ts
var InventoryMovement = (0, import_core45.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: {
      query: ({ session }) => permissions.canManageInventory({ session }) || permissions.canViewReports({ session }),
      create: () => false,
      update: () => false,
      delete: () => false
    },
    filter: {
      query: async ({ context }) => {
        try {
          const current = await currentStockContext(context, "history");
          return { location: stockLocationWhere(current) };
        } catch {
          return false;
        }
      }
    }
  },
  hooks: createLifecycleHooks("inventory_movement", [
    "type",
    "delta",
    "balanceBefore",
    "balanceAfter",
    "reason",
    "idempotencyKey",
    "locationId",
    "productId",
    "appointmentId"
  ]),
  fields: {
    type: (0, import_fields46.select)({
      type: "enum",
      options: [
        { label: "Receive", value: "receive" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Sale", value: "sale" },
        { label: "Return", value: "return" }
      ],
      validation: { isRequired: true }
    }),
    delta: (0, import_fields46.integer)({ validation: { isRequired: true } }),
    balanceBefore: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 } }),
    balanceAfter: (0, import_fields46.integer)({ validation: { isRequired: true, min: 0 } }),
    reason: (0, import_fields46.text)({ validation: { isRequired: true, length: { max: 500 } } }),
    idempotencyKey: (0, import_fields46.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    location: (0, import_fields46.relationship)({ ref: "Location.inventoryMovements" }),
    product: (0, import_fields46.relationship)({ ref: "Product.inventoryMovements" }),
    appointment: (0, import_fields46.relationship)({ ref: "Appointment.inventoryMovements" }),
    metadata: (0, import_fields46.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/ServiceSegment.ts
var import_core46 = require("@keystone-6/core");
var import_fields47 = require("@keystone-6/core/fields");
var ServiceSegment = (0, import_core46.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageCatalog,
      update: () => false,
      delete: () => false
    }
  },
  fields: {
    service: (0, import_fields47.relationship)({ ref: "Service.segmentDefinitions" }),
    stableKey: (0, import_fields47.text)({ validation: { isRequired: true, length: { max: 120 } } }),
    version: (0, import_fields47.integer)({ validation: { isRequired: true, min: 1 } }),
    sequence: (0, import_fields47.integer)({ validation: { isRequired: true, min: 0 } }),
    parallelGroup: (0, import_fields47.text)({ validation: { length: { max: 120 } } }),
    type: (0, import_fields47.select)({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Processing", value: "processing" },
        { label: "Finishing", value: "finishing" },
        { label: "Cleanup", value: "cleanup" }
      ],
      validation: { isRequired: true }
    }),
    durationMinutes: (0, import_fields47.integer)({ validation: { isRequired: true, min: 1 } }),
    practitionerRequired: (0, import_fields47.checkbox)({ defaultValue: true }),
    qualifiedPractitioners: (0, import_fields47.relationship)({ ref: "Stylist.segmentQualifications", many: true }),
    eligibleResources: (0, import_fields47.relationship)({ ref: "SalonResource.segmentDefinitions", many: true }),
    resourceUnits: (0, import_fields47.integer)({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    effectiveFrom: (0, import_fields47.timestamp)({ validation: { isRequired: true } }),
    effectiveUntil: (0, import_fields47.timestamp)(),
    supersedes: (0, import_fields47.relationship)({ ref: "ServiceSegment.supersededBy" }),
    supersededBy: (0, import_fields47.relationship)({ ref: "ServiceSegment.supersedes" }),
    ...trackingFields
  }
});

// features/keystone/models/AppointmentSegment.ts
var import_core47 = require("@keystone-6/core");
var import_fields48 = require("@keystone-6/core/fields");
var AppointmentSegment = (0, import_core47.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadAppointmentSegments }
  },
  fields: {
    appointment: (0, import_fields48.relationship)({ ref: "Appointment.segments" }),
    lineItem: (0, import_fields48.relationship)({ ref: "AppointmentLineItem.segments" }),
    definition: (0, import_fields48.relationship)({ ref: "ServiceSegment" }),
    revision: (0, import_fields48.relationship)({ ref: "AppointmentScheduleRevision.segments" }),
    stableKey: (0, import_fields48.text)({ validation: { isRequired: true, length: { max: 120 } } }),
    sequence: (0, import_fields48.integer)({ validation: { isRequired: true, min: 0 } }),
    parallelGroup: (0, import_fields48.text)({ validation: { length: { max: 120 } } }),
    type: (0, import_fields48.select)({
      type: "enum",
      options: [
        { label: "Service", value: "service" },
        { label: "Processing", value: "processing" },
        { label: "Finishing", value: "finishing" },
        { label: "Cleanup", value: "cleanup" }
      ],
      validation: { isRequired: true }
    }),
    plannedStart: (0, import_fields48.timestamp)({ validation: { isRequired: true } }),
    plannedEnd: (0, import_fields48.timestamp)({ validation: { isRequired: true } }),
    durationMinutes: (0, import_fields48.integer)({ validation: { isRequired: true, min: 1 } }),
    practitionerRequired: (0, import_fields48.checkbox)({ defaultValue: true }),
    practitioner: (0, import_fields48.relationship)({ ref: "Stylist.appointmentSegments" }),
    resource: (0, import_fields48.relationship)({ ref: "SalonResource.appointmentSegments" }),
    resourceUnits: (0, import_fields48.integer)({ defaultValue: 1, validation: { isRequired: true, min: 0 } }),
    status: (0, import_fields48.select)({
      type: "enum",
      options: [
        { label: "Planned", value: "planned" },
        { label: "Started", value: "started" },
        { label: "Completed", value: "completed" },
        { label: "Skipped", value: "skipped" },
        { label: "Superseded", value: "superseded" }
      ],
      defaultValue: "planned",
      validation: { isRequired: true }
    }),
    assignmentEvidence: (0, import_fields48.json)({ defaultValue: {} }),
    idempotencyKey: (0, import_fields48.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    transitions: (0, import_fields48.relationship)({ ref: "SegmentTransition.segment", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/AppointmentScheduleRevision.ts
var import_core48 = require("@keystone-6/core");
var import_fields49 = require("@keystone-6/core/fields");
var AppointmentScheduleRevision = (0, import_core48.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadAppointmentScheduleRevisions }
  },
  fields: {
    appointment: (0, import_fields49.relationship)({ ref: "Appointment.scheduleRevisions" }),
    revision: (0, import_fields49.integer)({ validation: { isRequired: true, min: 1 } }),
    priorStart: (0, import_fields49.timestamp)(),
    priorEnd: (0, import_fields49.timestamp)(),
    nextStart: (0, import_fields49.timestamp)({ validation: { isRequired: true } }),
    nextEnd: (0, import_fields49.timestamp)({ validation: { isRequired: true } }),
    reason: (0, import_fields49.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields49.relationship)({ ref: "User" }),
    actorAuthority: (0, import_fields49.text)({ validation: { isRequired: true, length: { max: 120 } } }),
    scheduleHash: (0, import_fields49.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    idempotencyKey: (0, import_fields49.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields49.json)({ defaultValue: {} }),
    segments: (0, import_fields49.relationship)({ ref: "AppointmentSegment.revision", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/SegmentTransition.ts
var import_core49 = require("@keystone-6/core");
var import_fields50 = require("@keystone-6/core/fields");
var SegmentTransition = (0, import_core49.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadSegmentTransitions }
  },
  fields: {
    segment: (0, import_fields50.relationship)({ ref: "AppointmentSegment.transitions" }),
    fromStatus: (0, import_fields50.select)({ type: "string", options: ["planned", "started", "completed", "skipped", "superseded"].map((value) => ({ label: value, value })) }),
    toStatus: (0, import_fields50.select)({ type: "string", options: ["planned", "started", "completed", "skipped", "superseded"].map((value) => ({ label: value, value })), validation: { isRequired: true } }),
    reason: (0, import_fields50.text)({ validation: { length: { max: 1e3 } } }),
    actor: (0, import_fields50.relationship)({ ref: "User" }),
    occurredAt: (0, import_fields50.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields50.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields50.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/TransactionReversal.ts
var import_core50 = require("@keystone-6/core");
var import_fields51 = require("@keystone-6/core/fields");
var TransactionReversal = (0, import_core50.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadTransactionReversals }
  },
  fields: {
    transaction: (0, import_fields51.relationship)({ ref: "SalonTransaction.reversals" }),
    payment: (0, import_fields51.relationship)({ ref: "Payment.reversals" }),
    type: (0, import_fields51.select)({
      type: "enum",
      options: [
        { label: "Void", value: "void" },
        { label: "Refund", value: "refund" },
        { label: "Partial refund", value: "partial_refund" },
        { label: "Compensation correction", value: "compensation" }
      ],
      validation: { isRequired: true }
    }),
    status: (0, import_fields51.select)({ type: "enum", options: [{ label: "Posted", value: "posted" }, { label: "Provider pending", value: "provider_pending" }], validation: { isRequired: true } }),
    subtotalDelta: (0, import_fields51.integer)({ validation: { isRequired: true, max: 0 } }),
    taxDelta: (0, import_fields51.integer)({ validation: { isRequired: true, max: 0 } }),
    tipDelta: (0, import_fields51.integer)({ validation: { isRequired: true, max: 0 } }),
    paymentDelta: (0, import_fields51.integer)({ validation: { isRequired: true, max: 0 } }),
    commissionDelta: (0, import_fields51.integer)({ validation: { isRequired: true } }),
    reason: (0, import_fields51.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields51.relationship)({ ref: "User" }),
    providerReference: (0, import_fields51.text)({ validation: { length: { max: 500 } } }),
    idempotencyKey: (0, import_fields51.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    postedAt: (0, import_fields51.timestamp)({ validation: { isRequired: true } }),
    conservationEvidence: (0, import_fields51.json)({ defaultValue: {} }),
    lines: (0, import_fields51.relationship)({ ref: "TransactionReversalLine.reversal", many: true }),
    commissionAdjustments: (0, import_fields51.relationship)({ ref: "CommissionAdjustment.reversal", many: true }),
    gratuityEntries: (0, import_fields51.relationship)({ ref: "GratuityLedgerEntry.reversal", many: true }),
    depositAdjustments: (0, import_fields51.relationship)({ ref: "DepositAdjustment.reversal", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/TransactionReversalLine.ts
var import_core51 = require("@keystone-6/core");
var import_fields52 = require("@keystone-6/core/fields");
var TransactionReversalLine = (0, import_core51.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadTransactionReversalLines }
  },
  fields: {
    reversal: (0, import_fields52.relationship)({ ref: "TransactionReversal.lines" }),
    sourceLine: (0, import_fields52.relationship)({ ref: "SalonTransactionLineItem.reversalLines" }),
    quantity: (0, import_fields52.integer)({ validation: { isRequired: true, min: 1 } }),
    subtotalDelta: (0, import_fields52.integer)({ validation: { isRequired: true, max: 0 } }),
    taxDelta: (0, import_fields52.integer)({ validation: { isRequired: true, max: 0 } }),
    commissionDelta: (0, import_fields52.integer)({ validation: { isRequired: true, max: 0 } }),
    inventoryDisposition: (0, import_fields52.select)({
      type: "enum",
      options: [
        { label: "Not applicable", value: "not_applicable" },
        { label: "Return to stock", value: "return_to_stock" },
        { label: "Damaged", value: "damaged" },
        { label: "Consumed", value: "consumed" }
      ],
      validation: { isRequired: true }
    }),
    inventoryMovement: (0, import_fields52.relationship)({ ref: "InventoryMovement" }),
    idempotencyKey: (0, import_fields52.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields52.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/CommissionAdjustment.ts
var import_core52 = require("@keystone-6/core");
var import_fields53 = require("@keystone-6/core/fields");
var CommissionAdjustment = (0, import_core52.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadCommissionAdjustments }
  },
  fields: {
    commission: (0, import_fields53.relationship)({ ref: "Commission.adjustments" }),
    reversal: (0, import_fields53.relationship)({ ref: "TransactionReversal.commissionAdjustments" }),
    amountDelta: (0, import_fields53.integer)({ validation: { isRequired: true } }),
    payablePeriod: (0, import_fields53.text)({ validation: { isRequired: true, length: { max: 100 } } }),
    reason: (0, import_fields53.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields53.relationship)({ ref: "User" }),
    postedAt: (0, import_fields53.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields53.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields53.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/GratuityLedgerEntry.ts
var import_core53 = require("@keystone-6/core");
var import_fields54 = require("@keystone-6/core/fields");
var GratuityLedgerEntry = (0, import_core53.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadGratuityEntries }
  },
  fields: {
    payment: (0, import_fields54.relationship)({ ref: "Payment.gratuityEntries" }),
    reversal: (0, import_fields54.relationship)({ ref: "TransactionReversal.gratuityEntries" }),
    practitioner: (0, import_fields54.relationship)({ ref: "Stylist.gratuityEntries" }),
    type: (0, import_fields54.select)({ type: "enum", options: [{ label: "Allocation", value: "allocation" }, { label: "Recovery", value: "recovery" }], validation: { isRequired: true } }),
    amountDelta: (0, import_fields54.integer)({ validation: { isRequired: true } }),
    payoutStatus: (0, import_fields54.select)({ type: "enum", options: [{ label: "Payable", value: "payable" }, { label: "Paid", value: "paid" }, { label: "Recovery due", value: "recovery_due" }], validation: { isRequired: true } }),
    reason: (0, import_fields54.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields54.relationship)({ ref: "User" }),
    postedAt: (0, import_fields54.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields54.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields54.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/ConsultationTemplateVersion.ts
var import_core54 = require("@keystone-6/core");
var import_fields55 = require("@keystone-6/core/fields");
var ConsultationTemplateVersion = (0, import_core54.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: {
      query: permissions.canManageCareRecords,
      create: () => false,
      update: () => false,
      delete: () => false
    }
  },
  fields: {
    template: (0, import_fields55.relationship)({ ref: "FormTemplate.versions" }),
    version: (0, import_fields55.text)({ validation: { isRequired: true, length: { max: 100 } } }),
    titleSnapshot: (0, import_fields55.text)({ validation: { isRequired: true, length: { max: 300 } } }),
    purposeSnapshot: (0, import_fields55.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    questions: (0, import_fields55.json)({ defaultValue: [] }),
    questionsHash: (0, import_fields55.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    documentHash: (0, import_fields55.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    idempotencyKey: (0, import_fields55.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    effectiveFrom: (0, import_fields55.timestamp)({ validation: { isRequired: true } }),
    effectiveUntil: (0, import_fields55.timestamp)(),
    supersedes: (0, import_fields55.relationship)({ ref: "ConsultationTemplateVersion.supersededBy" }),
    supersededBy: (0, import_fields55.relationship)({ ref: "ConsultationTemplateVersion.supersedes" }),
    submissions: (0, import_fields55.relationship)({ ref: "ConsultationSubmission.templateVersion", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/ConsultationSubmission.ts
var import_core55 = require("@keystone-6/core");
var import_fields56 = require("@keystone-6/core/fields");
var ConsultationSubmission = (0, import_core55.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadConsultationSubmissions }
  },
  fields: {
    client: (0, import_fields56.relationship)({ ref: "User.consultationSubmissions" }),
    appointment: (0, import_fields56.relationship)({ ref: "Appointment.consultationSubmissions" }),
    templateVersion: (0, import_fields56.relationship)({ ref: "ConsultationTemplateVersion.submissions" }),
    answers: (0, import_fields56.json)({ defaultValue: {} }),
    questionsHash: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    answersHash: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    evidenceHash: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 128 } } }),
    signerName: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 200 } } }),
    signerRole: (0, import_fields56.select)({
      type: "enum",
      options: [
        { label: "Self", value: "self" },
        { label: "Parent", value: "parent" },
        { label: "Guardian", value: "guardian" },
        { label: "Authorized representative", value: "representative" }
      ],
      validation: { isRequired: true }
    }),
    guardianAuthority: (0, import_fields56.text)({ validation: { length: { max: 1e3 } } }),
    signatureEvidence: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 5e3 } } }),
    actor: (0, import_fields56.relationship)({ ref: "User" }),
    actorAuthority: (0, import_fields56.text)({ validation: { isRequired: true, length: { max: 120 } } }),
    submittedAt: (0, import_fields56.timestamp)({ validation: { isRequired: true } }),
    effectiveFrom: (0, import_fields56.timestamp)({ validation: { isRequired: true } }),
    effectiveUntil: (0, import_fields56.timestamp)(),
    supersedes: (0, import_fields56.relationship)({ ref: "ConsultationSubmission.supersededBy" }),
    supersededBy: (0, import_fields56.relationship)({ ref: "ConsultationSubmission.supersedes" }),
    idempotencyKey: (0, import_fields56.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    // Denormalized desk projection; controlled review workflow updates it with each immutable review event.
    reviewStatus: (0, import_fields56.select)({
      type: "enum",
      options: [
        { label: "Submitted", value: "submitted" },
        { label: "Reviewed", value: "reviewed" },
        { label: "Needs clarification", value: "needs_clarification" },
        { label: "Accepted for service", value: "accepted_for_service" },
        { label: "Deferred", value: "deferred" }
      ],
      defaultValue: "submitted",
      validation: { isRequired: true }
    }),
    reviews: (0, import_fields56.relationship)({ ref: "ConsultationReview.submission", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/ConsultationReview.ts
var import_core56 = require("@keystone-6/core");
var import_fields57 = require("@keystone-6/core/fields");
var ConsultationReview = (0, import_core56.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadConsultationReviews }
  },
  fields: {
    submission: (0, import_fields57.relationship)({ ref: "ConsultationSubmission.reviews" }),
    status: (0, import_fields57.select)({
      type: "enum",
      options: ["reviewed", "needs_clarification", "accepted_for_service", "deferred"].map((value) => ({ label: value, value })),
      validation: { isRequired: true }
    }),
    reason: (0, import_fields57.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields57.relationship)({ ref: "User" }),
    actorAuthority: (0, import_fields57.text)({ validation: { isRequired: true, length: { max: 120 } } }),
    occurredAt: (0, import_fields57.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields57.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields57.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/ClientPackageAdjustment.ts
var import_core57 = require("@keystone-6/core");
var import_fields58 = require("@keystone-6/core/fields");
var ClientPackageAdjustment = (0, import_core57.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadClientPackageAdjustments }
  },
  fields: {
    clientPackage: (0, import_fields58.relationship)({ ref: "ClientPackage.adjustments" }),
    reversal: (0, import_fields58.relationship)({ ref: "TransactionReversal" }),
    valueDelta: (0, import_fields58.integer)({ validation: { isRequired: true } }),
    reason: (0, import_fields58.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields58.relationship)({ ref: "User" }),
    postedAt: (0, import_fields58.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields58.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields58.json)({ defaultValue: {} }),
    ...trackingFields
  }
});

// features/keystone/models/DepositAdjustment.ts
var import_core58 = require("@keystone-6/core");
var import_fields59 = require("@keystone-6/core/fields");
var DepositAdjustment = (0, import_core58.list)({
  ui: { hideCreate: true, hideDelete: true },
  access: {
    operation: { query: () => true, create: () => false, update: () => false, delete: () => false },
    filter: { query: rules.canReadDepositAdjustments }
  },
  fields: {
    reversal: (0, import_fields59.relationship)({ ref: "TransactionReversal.depositAdjustments" }),
    paymentSession: (0, import_fields59.relationship)({ ref: "PaymentSession" }),
    amountDelta: (0, import_fields59.integer)({ validation: { isRequired: true, max: 0 } }),
    reason: (0, import_fields59.text)({ validation: { isRequired: true, length: { max: 1e3 } } }),
    actor: (0, import_fields59.relationship)({ ref: "User" }),
    postedAt: (0, import_fields59.timestamp)({ validation: { isRequired: true } }),
    idempotencyKey: (0, import_fields59.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    evidence: (0, import_fields59.json)({ defaultValue: {} }),
    ...trackingFields
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
  PaymentProvider,
  PaymentSession,
  PaymentWebhookEvent,
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
  StoreSettings,
  SalonResource,
  Product,
  ProductSale,
  Commission,
  Review,
  SalonTransaction,
  SalonTransactionLineItem,
  ClientPackage,
  ClientPackageUsage,
  DomainEvent,
  InventoryMovement,
  ServiceSegment,
  AppointmentSegment,
  AppointmentScheduleRevision,
  SegmentTransition,
  TransactionReversal,
  TransactionReversalLine,
  CommissionAdjustment,
  GratuityLedgerEntry,
  ConsultationTemplateVersion,
  ConsultationSubmission,
  ConsultationReview,
  ClientPackageAdjustment,
  DepositAdjustment
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_core84 = require("@keystone-6/core");

// features/keystone/mutations/registerSalonCustomer.ts
var import_core59 = require("@keystone-6/core");

// features/keystone/mutations/currentWorkflowAuthority.ts
var ROLE_FLAGS = Object.keys(permissions);
async function assertCurrentWorkflowAuthority(context) {
  const session = context.session;
  if (!session) return;
  if (session.listKey !== "User" || !session.itemId) throw new Error("Current session authority is required");
  const actors = await context.prisma.$queryRawUnsafe(
    'SELECT "id", "role" FROM "User" WHERE "id" = $1 FOR SHARE',
    session.itemId
  );
  if (actors.length !== 1) throw new Error("Current session authority is required");
  if (actors[0].role) await context.prisma.$queryRawUnsafe('SELECT "id" FROM "Role" WHERE "id" = $1 FOR SHARE', actors[0].role);
  const actor = await context.query.User.findOne({ where: { id: session.itemId }, query: `id role { ${ROLE_FLAGS.join(" ")} }` });
  if (!actor || actor.id !== session.itemId) throw new Error("Current session authority is required");
  const claimed = session.data?.role;
  const actual = actor.role;
  if (ROLE_FLAGS.some((flag) => claimed?.[flag] === true && actual?.[flag] !== true)) throw new Error("Authority changed; sign in again before retrying");
}

// features/keystone/scheduling/capacityFence.ts
async function acquireSalonCapacityFence(context) {
  await context.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "salon-appointment-capacity", "!writers");
}
var CAPACITY_WORKFLOWS = /* @__PURE__ */ new Set(["salon-segment-schedule", "salon-segment-transition", "salon-schedule", "salon-resource", "salon-management", "salon-appointment-transition"]);

// features/keystone/mutations/serializableWorkflow.ts
var TRANSIENT_CODES = /* @__PURE__ */ new Set(["P2034", "40001", "40P01"]);
var TRANSIENT_MESSAGE = /\bP2034\b|\bwrite conflict\b|\bdeadlock (?:detected|found)\b|please retry your transaction/i;
var MAX_DIAGNOSTIC_DEPTH = 8;
var MAX_DIAGNOSTIC_NODES = 128;
var MAX_DIAGNOSTIC_STRING_LENGTH = 1e5;
function retryableTransactionError(error) {
  const seen = /* @__PURE__ */ new WeakSet();
  let visited = 0;
  function inspect(value, depth, propertyName = "") {
    if (depth > MAX_DIAGNOSTIC_DEPTH || visited >= MAX_DIAGNOSTIC_NODES || value == null) return false;
    if (typeof value === "string") {
      const diagnostic = value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH);
      if (TRANSIENT_MESSAGE.test(diagnostic)) return true;
      return /^(code|sqlstate|sql_state|prismaCode)$/i.test(propertyName) && TRANSIENT_CODES.has(diagnostic.toUpperCase());
    }
    if (typeof value !== "object") return false;
    if (seen.has(value)) return false;
    seen.add(value);
    visited += 1;
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      return false;
    }
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor)) continue;
      const child = descriptor.value;
      if (/^(code|sqlstate|sql_state|prismaCode)$/i.test(name) && typeof child === "string" && TRANSIENT_CODES.has(child.toUpperCase())) return true;
      if (inspect(child, depth + 1, name)) return true;
    }
    return false;
  }
  return inspect(error, 0);
}
async function serializableWorkflow(context, namespace, lockKeys, work) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.transaction(async (transactionContext) => {
        if (CAPACITY_WORKFLOWS.has(namespace)) await acquireSalonCapacityFence(transactionContext);
        for (const key of [...new Set(lockKeys)].sort()) {
          await transactionContext.prisma.$executeRawUnsafe(
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
            namespace,
            key
          );
        }
        await assertCurrentWorkflowAuthority(transactionContext);
        return work(transactionContext);
      }, {
        maxWait: 5e3,
        timeout: 3e4,
        isolationLevel: "Serializable"
      });
    } catch (error) {
      if (!retryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Serializable workflow retry exhausted");
}

// features/keystone/mutations/registerSalonCustomer.ts
var registerSalonCustomer = import_core59.graphql.field({
  type: import_core59.graphql.nonNull(import_core59.graphql.Boolean),
  args: {
    name: import_core59.graphql.arg({ type: import_core59.graphql.nonNull(import_core59.graphql.String) }),
    email: import_core59.graphql.arg({ type: import_core59.graphql.nonNull(import_core59.graphql.String) }),
    password: import_core59.graphql.arg({ type: import_core59.graphql.nonNull(import_core59.graphql.String) })
  },
  async resolve(_root, args, context) {
    if (context.session) throw new Error("Sign out before creating an account");
    const name = args.name.trim(), email = args.email.trim().toLowerCase();
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.password.length < 12 || args.password.length > 128) throw new Error("Enter a name, valid email and a password of 12\u2013128 characters");
    await serializableWorkflow(context, "salon-customer-registration", [email], async (tx) => {
      const sudo = tx.sudo();
      if (await sudo.query.User.count({ where: { email: { equals: email, mode: "insensitive" } } })) throw new Error("Account could not be created. Sign in or contact the salon.");
      if (await sudo.query.User.count() === 0) throw new Error("Salon setup is not complete");
      const user = await sudo.query.User.createOne({ data: { name, email, password: args.password, onboardingStatus: "dismissed" }, query: "id" });
      await sudo.query.Client.createOne({ data: { user: { connect: { id: user.id } } }, query: "id" });
    });
    return true;
  }
});

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
var import_core60 = require("@keystone-6/core");

// features/keystone/mutations/depositRefund.ts
var import_node_crypto2 = require("node:crypto");

// features/integrations/payment/index.ts
var adapters = {
  manual: async () => (await Promise.resolve().then(() => (init_manual(), manual_exports))).manualPaymentAdapter,
  stripe: async () => (await Promise.resolve().then(() => (init_stripe(), stripe_exports))).stripePaymentAdapter
};
async function getPaymentAdapter(provider) {
  const loader = adapters[provider.adapter];
  if (!loader) throw new Error(`Unsupported payment adapter: ${provider.adapter}`);
  return loader();
}

// features/keystone/utils/paymentProviderAdapter.ts
async function createProviderPaymentSession(input) {
  return (await getPaymentAdapter(input.provider)).createSession(input);
}
async function confirmProviderPayment(input) {
  return (await getPaymentAdapter(input.provider)).confirm(input);
}
async function refundProviderPayment(input) {
  return (await getPaymentAdapter(input.provider)).refund(input);
}
function paymentProviderFromRecord(record) {
  if (record.adapter !== "manual" && record.adapter !== "stripe") {
    throw new Error(`Unsupported payment adapter: ${record.adapter}`);
  }
  return {
    code: record.code,
    adapter: record.adapter,
    config: record.config && typeof record.config === "object" ? record.config : {}
  };
}

// features/keystone/mutations/depositRefund.ts
async function refundAppointmentDeposit(context, input) {
  const denied11 = { success: false, refundId: null, status: null };
  if (!permissions.canIssueRefunds({ session: context.session })) return { ...denied11, error: "You must have refund authority" };
  if (!input.idempotencyKey || input.idempotencyKey.length < 12 || input.idempotencyKey.length > 160 || !input.reason?.trim()) return { ...denied11, error: "A unique refund operation key and reason are required" };
  const key = (0, import_node_crypto2.createHash)("sha256").update(input.idempotencyKey).digest("hex");
  try {
    const prepared = await serializableWorkflow(context, "salon-domain-resource", [`deposit:${input.paymentSessionId}`], async (tx) => {
      const current = await currentStockContext(tx, "return");
      const sudo = current.sudo();
      const session = await sudo.query.PaymentSession.findOne({ where: { id: input.paymentSessionId }, query: "id amount status providerReference data provider { id code adapter config } payment { id status refundedAmount } appointment { id transaction { id } }" });
      if (!session?.payment || !session.provider || session.data?.purpose !== "appointment_deposit") throw new Error("Deposit payment not found");
      if (session.appointment?.transaction?.id) throw new Error("Use the sale reversal workflow after a deposit has been applied");
      const data = session.data, operations = { ...data.refundOperations || {} };
      const existing = operations[key];
      if (existing) {
        if (input.amount != null && existing.amount !== input.amount || existing.reason !== input.reason.trim()) throw new Error("Refund key was reused with different input");
        return { session, operation: existing, key };
      }
      if (Object.values(operations).some((operation2) => !["completed", "failed"].includes(operation2.status))) throw new Error("An earlier refund requires reconciliation before another refund");
      if (!["completed", "partially_refunded"].includes(session.payment.status)) throw new Error("Deposit is not refundable");
      const baseRefunded = Number(session.payment.refundedAmount || 0), amount = input.amount ?? session.amount - baseRefunded;
      if (!Number.isSafeInteger(amount) || amount <= 0 || baseRefunded + amount > session.amount) throw new Error("Invalid refund amount");
      const operation = { amount, baseRefunded, reason: input.reason.trim(), status: "prepared", actorId: context.session.itemId, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      operations[key] = operation;
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { data: { ...data, refundOperations: operations } }, query: "id" });
      return { session, operation, key };
    });
    if (prepared.operation.status === "completed") return { success: true, refundId: prepared.operation.refundId || null, status: prepared.operation.resultStatus, error: null };
    const result2 = await refundProviderPayment({ provider: paymentProviderFromRecord(prepared.session.provider), providerReference: prepared.session.providerReference, amount: prepared.operation.amount, refundId: prepared.operation.refundId || void 0, idempotencyKey: `deposit-refund:${prepared.session.id}:${key}` });
    return await serializableWorkflow(context, "salon-domain-resource", [`deposit:${input.paymentSessionId}`], async (tx) => {
      const current = await currentStockContext(tx, "return");
      const sudo = current.sudo();
      const session = await sudo.query.PaymentSession.findOne({ where: { id: input.paymentSessionId }, query: "id amount data payment { id refundedAmount } appointment { id }" });
      const data = session.data, operation = data.refundOperations?.[key];
      if (!operation) throw new Error("Refund operation evidence is missing");
      if (operation.status === "completed") return { success: true, refundId: operation.refundId || null, status: operation.resultStatus, error: null };
      const completed = result2.status === "refunded" || result2.status === "completed";
      if (completed && result2.amount != null && result2.amount !== operation.amount) throw new Error("Provider refund amount does not match the reserved operation; reconciliation required");
      const refunded = Math.max(Number(session.payment.refundedAmount || 0), operation.baseRefunded + operation.amount);
      const status = refunded === session.amount ? "refunded" : "partially_refunded";
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const next = { ...operation, status: completed ? "completed" : result2.status === "failed" ? "failed" : "pending", resultStatus: completed ? status : result2.status, refundId: result2.data?.refundId || null, updatedAt: now };
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { ...completed ? { status, refundedAt: now } : {}, data: { ...data, refundOperations: { ...data.refundOperations, [key]: next } } }, query: "id" });
      if (completed) {
        await sudo.query.Payment.updateOne({ where: { id: session.payment.id }, data: { status, refundedAmount: refunded, refundReason: operation.reason, refundedAt: now }, query: "id" });
        if (session.appointment?.id) await sudo.query.Appointment.updateOne({ where: { id: session.appointment.id }, data: { depositPaid: refunded < session.amount }, query: "id" });
      }
      return { success: completed, refundId: typeof result2.data?.refundId === "string" ? result2.data.refundId : null, status: completed ? status : result2.status, error: completed ? null : "Refund is not completed; reconcile the same operation before retrying" };
    });
  } catch (error) {
    return { ...denied11, error: error instanceof Error ? error.message : "Refund failed; retry only with the same operation key" };
  }
}

// features/keystone/payment-lifecycle.ts
var transitions = {
  pending: ["requires_action", "authorized", "completed", "failed", "cancelled"],
  requires_action: ["authorized", "completed", "failed", "cancelled"],
  authorized: ["completed", "failed", "cancelled"],
  completed: ["partially_refunded", "refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  failed: [],
  cancelled: [],
  refunded: []
};
function canTransitionPayment(from, to) {
  return from === to || transitions[from].includes(to);
}
function assertPaymentTransition(from, to) {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}
function paymentRecordStatus(status) {
  if (status === "requires_action" || status === "authorized") return "processing";
  if (status === "partially_refunded") return "partially_refunded";
  if (status === "refunded") return "refunded";
  if (status === "completed") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  return "pending";
}

// features/keystone/mutations/processPayment.ts
var TAX_RATE = Number.parseFloat(process.env.TAX_RATE || "0.08");
function paymentOperator(context) {
  return permissions.canManagePayments({ session: context.session });
}
function denied2(extra = {}) {
  return { success: false, error: "You must be an authorized salon operator", ...extra };
}
async function paymentTransaction(context, lockKeys, work) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.transaction(async (transactionContext) => {
        for (const key of [...new Set(lockKeys)].sort()) {
          await transactionContext.prisma.$executeRawUnsafe(
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
            "salon-payment-lifecycle",
            key
          );
        }
        await assertCurrentWorkflowAuthority(transactionContext);
        return work(transactionContext.sudo());
      }, {
        maxWait: 5e3,
        timeout: 3e4,
        isolationLevel: "Serializable"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error?.code === "P2034" || error?.extensions?.prisma?.code === "P2034" || /write conflict|deadlock|please retry your transaction/i.test(message);
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Payment transaction retry exhausted");
}
var SAFE_PAYMENT_ERRORS = /* @__PURE__ */ new Set([
  "Appointment not found",
  "Appointment is not eligible for payment",
  "Appointment already has a payment",
  "Appointment has no payable line items",
  "Payment provider is unavailable",
  "Payment session not found",
  "Provider has not completed the payment",
  "Invalid refund amount",
  "Completed payment not found",
  "No tip to distribute",
  "Idempotency key is invalid",
  "Idempotency key was already used for another operation"
]);
function safeError(error) {
  console.error("Payment workflow failed:", error);
  if (error instanceof Error && (error.message.startsWith("Invalid payment transition") || SAFE_PAYMENT_ERRORS.has(error.message))) {
    return error.message;
  }
  return "Payment operation failed";
}
async function loadProvider(sudo, providerCode) {
  const providers = await sudo.query.PaymentProvider.findMany({
    where: providerCode ? { code: { equals: providerCode }, isInstalled: { equals: true } } : { isInstalled: { equals: true }, isDefault: { equals: true } },
    take: 1,
    query: "id code adapter config isInstalled isDefault"
  });
  const provider = providers[0];
  if (!provider) throw new Error("Payment provider is unavailable");
  return provider;
}
async function loadSession(sudo, sessionId) {
  return sudo.query.PaymentSession.findOne({
    where: { id: sessionId },
    query: `
      id amount currency status providerReference idempotencyKey data
      provider { id code adapter config isInstalled }
      payment { id status totalAmount refundedAmount appointment { id } }
      appointment { id status client { user { email } } }
    `
  });
}
var processPayment = import_core60.graphql.field({
  type: import_core60.graphql.object()({
    name: "ProcessPaymentResult",
    fields: {
      success: import_core60.graphql.field({ type: import_core60.graphql.nonNull(import_core60.graphql.Boolean) }),
      paymentId: import_core60.graphql.field({ type: import_core60.graphql.String }),
      paymentSessionId: import_core60.graphql.field({ type: import_core60.graphql.String }),
      error: import_core60.graphql.field({ type: import_core60.graphql.String }),
      clientSecret: import_core60.graphql.field({ type: import_core60.graphql.String }),
      status: import_core60.graphql.field({ type: import_core60.graphql.String })
    }
  }),
  args: {
    appointmentId: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.ID) }),
    paymentMethod: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.String) }),
    providerCode: import_core60.graphql.arg({ type: import_core60.graphql.String }),
    idempotencyKey: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.String) }),
    tipAmount: import_core60.graphql.arg({ type: import_core60.graphql.Int }),
    discountAmount: import_core60.graphql.arg({ type: import_core60.graphql.Int })
  },
  async resolve(source, args, context) {
    if (!paymentOperator(context)) return { success: false, paymentId: null, paymentSessionId: null, error: "You must have payment authority", clientSecret: null, status: null };
    if (args.appointmentId) return {
      success: false,
      paymentId: null,
      paymentSessionId: null,
      error: "Use controlled appointment checkout",
      clientSecret: null,
      status: null
    };
    try {
      return await paymentTransaction(context, [`idempotency:${args.idempotencyKey}`, `appointment:${args.appointmentId}`], async (sudo) => {
        if (args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 200) throw new Error("Idempotency key is invalid");
        if (!(/* @__PURE__ */ new Set(["credit_card", "debit_card", "cash", "gift_card", "apple_pay", "google_pay"])).has(args.paymentMethod)) {
          throw new Error("Payment operation failed");
        }
        if ((args.tipAmount || 0) < 0 || (args.discountAmount || 0) < 0 || (args.tipAmount || 0) > 1e7 || (args.discountAmount || 0) > 1e7) {
          throw new Error("Payment operation failed");
        }
        const existing = (await sudo.query.PaymentSession.findMany({
          where: { idempotencyKey: { equals: args.idempotencyKey } },
          take: 1,
          query: "id status data appointment { id } payment { id }"
        }))[0];
        if (existing) {
          if (existing.appointment?.id !== args.appointmentId) throw new Error("Idempotency key was already used for another operation");
          const data = existing.data && typeof existing.data === "object" ? existing.data : {};
          return { success: true, paymentId: existing.payment?.id || null, paymentSessionId: existing.id, error: null, clientSecret: data.clientSecret || null, status: existing.status };
        }
        const appointment = await sudo.query.Appointment.findOne({
          where: { id: args.appointmentId },
          query: `id status payment { id status } lineItems { price quantity } client { user { email } }`
        });
        if (!appointment) throw new Error("Appointment not found");
        if (!["confirmed", "in_progress"].includes(appointment.status || "")) throw new Error("Appointment is not eligible for payment");
        if (appointment.payment?.id) throw new Error("Appointment already has a payment");
        const subtotalCents = appointment.lineItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
        if (subtotalCents <= 0) throw new Error("Appointment has no payable line items");
        const tipCents = Math.max(0, args.tipAmount || 0);
        const discountCents = Math.max(0, args.discountAmount || 0);
        const taxCents = Math.round(subtotalCents * TAX_RATE);
        const totalCents = Math.max(0, subtotalCents + taxCents + tipCents - discountCents);
        const provider = await loadProvider(sudo, args.providerCode);
        const providerConfig = paymentProviderFromRecord(provider);
        const adapterResult = await createProviderPaymentSession({
          provider: providerConfig,
          amount: totalCents,
          currency: "usd",
          idempotencyKey: args.idempotencyKey,
          metadata: { appointmentId: appointment.id, operatorId: context.session.itemId }
        });
        const session = await sudo.query.PaymentSession.createOne({
          data: {
            appointment: { connect: { id: appointment.id } },
            provider: { connect: { id: provider.id } },
            idempotencyKey: args.idempotencyKey,
            amount: totalCents,
            currency: "usd",
            status: adapterResult.status,
            providerReference: adapterResult.providerReference,
            data: { ...adapterResult.data || {}, clientSecret: adapterResult.clientSecret || null }
          },
          query: "id"
        });
        const completed = adapterResult.status === "completed";
        const payment = await sudo.query.Payment.createOne({
          data: {
            subtotal: subtotalCents,
            tax: taxCents,
            tip: tipCents,
            discount: discountCents,
            totalAmount: totalCents,
            paymentMethod: args.paymentMethod,
            status: paymentRecordStatus(adapterResult.status),
            appointment: { connect: { id: appointment.id } },
            session: { connect: { id: session.id } },
            processedBy: { connect: { id: context.session.itemId } },
            processedAt: completed ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
            receiptEmail: appointment.client?.user?.email || ""
          },
          query: "id"
        });
        await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } }, ...completed ? { completedAt: (/* @__PURE__ */ new Date()).toISOString() } : {} }, query: "id" });
        if (completed) await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data: { status: "completed" }, query: "id" });
        return { success: true, paymentId: payment.id, paymentSessionId: session.id, error: null, clientSecret: adapterResult.clientSecret || null, status: adapterResult.status };
      });
    } catch (error) {
      return { success: false, paymentId: null, paymentSessionId: null, error: safeError(error), clientSecret: null, status: null };
    }
  }
});
var confirmPayment = import_core60.graphql.field({
  type: import_core60.graphql.object()({
    name: "ConfirmPaymentResult",
    fields: { success: import_core60.graphql.field({ type: import_core60.graphql.nonNull(import_core60.graphql.Boolean) }), error: import_core60.graphql.field({ type: import_core60.graphql.String }), status: import_core60.graphql.field({ type: import_core60.graphql.String }) }
  }),
  args: { paymentSessionId: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.ID) }) },
  async resolve(source, { paymentSessionId }, context) {
    if (!paymentOperator(context)) return { success: false, error: "You must have payment authority", status: null };
    try {
      return await paymentTransaction(context, [`session:${paymentSessionId}`], async (sudo) => {
        const session = await loadSession(sudo, paymentSessionId);
        if (!session?.provider || !session.providerReference || !session.payment) throw new Error("Payment session not found");
        const sessionData = session.data && typeof session.data === "object" ? session.data : {};
        if (sessionData.purpose !== "appointment_deposit") throw new Error("Use the purpose-built settlement confirmation workflow");
        if (session.status === "completed") return { success: true, error: null, status: "completed" };
        assertPaymentTransition(session.status, "completed");
        if (session.provider.adapter !== "manual") throw new Error("Online deposit confirmation requires the provider reconciliation workflow");
        const result2 = await confirmProviderPayment({ provider: paymentProviderFromRecord(session.provider), providerReference: session.providerReference, amount: session.amount, idempotencyKey: `${session.idempotencyKey}:confirm` });
        assertPaymentTransition(session.status, result2.status);
        if (result2.status !== "completed") throw new Error("Provider has not completed the payment");
        if (result2.amount != null && result2.amount !== session.amount) throw new Error("Provider amount does not match payment session");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "completed", completedAt: now, data: { ...sessionData, ...result2.data || {} } }, query: "id" });
        await sudo.query.Payment.updateOne({ where: { id: session.payment.id }, data: { status: "completed", processedAt: now }, query: "id" });
        if (session.appointment?.id) {
          await sudo.query.Appointment.updateOne({
            where: { id: session.appointment.id },
            data: sessionData.purpose === "appointment_deposit" ? { depositPaid: true, ...session.appointment.status === "pending" ? { status: "confirmed", confirmedAt: now } : {} } : { status: "completed" },
            query: "id"
          });
        }
        return { success: true, error: null, status: "completed" };
      });
    } catch (error) {
      return { success: false, error: safeError(error), status: null };
    }
  }
});
var refundPayment = import_core60.graphql.field({
  type: import_core60.graphql.object()({
    name: "RefundPaymentResult",
    fields: { success: import_core60.graphql.field({ type: import_core60.graphql.nonNull(import_core60.graphql.Boolean) }), refundId: import_core60.graphql.field({ type: import_core60.graphql.String }), error: import_core60.graphql.field({ type: import_core60.graphql.String }), status: import_core60.graphql.field({ type: import_core60.graphql.String }) }
  }),
  args: { paymentSessionId: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.ID) }), amount: import_core60.graphql.arg({ type: import_core60.graphql.Int }), reason: import_core60.graphql.arg({ type: import_core60.graphql.String }), idempotencyKey: import_core60.graphql.arg({ type: import_core60.graphql.String }) },
  resolve(_source, args, context) {
    return refundAppointmentDeposit(context, args);
  }
});
var distributeTip = import_core60.graphql.field({
  type: import_core60.graphql.object()({ name: "DistributeTipResult", fields: { success: import_core60.graphql.field({ type: import_core60.graphql.nonNull(import_core60.graphql.Boolean) }), error: import_core60.graphql.field({ type: import_core60.graphql.String }) } }),
  args: { paymentId: import_core60.graphql.arg({ type: import_core60.graphql.nonNull(import_core60.graphql.ID) }) },
  async resolve(source, { paymentId }, context) {
    if (!paymentOperator(context)) return denied2();
    if (paymentId) return { success: false, error: "Tip distribution requires the controlled gratuity allocation workflow" };
    try {
      return await paymentTransaction(context, [`payment:${paymentId}`], async (sudo) => {
        const payment = await sudo.query.Payment.findOne({ where: { id: paymentId }, query: "id tip tipDistributed status" });
        if (!payment || payment.status !== "completed") throw new Error("Completed payment not found");
        if (payment.tipDistributed) return { success: true, error: null };
        if (!payment.tip || payment.tip <= 0) throw new Error("No tip to distribute");
        await sudo.query.Payment.updateOne({ where: { id: paymentId }, data: { tipDistributed: true }, query: "id" });
        return { success: true, error: null };
      });
    } catch (error) {
      return { success: false, error: safeError(error) };
    }
  }
});
var paymentMutations = { processPayment, confirmPayment, refundPayment, distributeTip };

// features/keystone/mutations/purchaseGiftCard.ts
var import_node_crypto3 = require("node:crypto");
var import_core61 = require("@keystone-6/core");

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
function hasSmtpConfiguration() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
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
function appointmentConfirmationEmail(params) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const primaryColor = `hsl(${params.themeHue} 45% 38%)`;
  const borderColor = "#e5e7eb";
  return `
    <body style="background: ${backgroundColor}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: ${backgroundColor}; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background: ${mainBackgroundColor}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 2px solid ${primaryColor};">
                  <h1 style="margin: 0; font-size: 28px; color: ${primaryColor}; font-weight: bold;">Appointment Confirmed!</h1>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 40px 20px 40px;">
                  <p style="margin: 0; font-size: 16px; color: ${textColor}; line-height: 1.6;">
                    Hi ${params.clientName},
                  </p>
                  <p style="margin: 15px 0 0 0; font-size: 16px; color: ${textColor}; line-height: 1.6;">
                    We're excited to see you! Your appointment has been confirmed.
                  </p>
                </td>
              </tr>

              <!-- Appointment Details -->
              <tr>
                <td style="padding: 20px 40px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #f8f9fa; border-radius: 8px; border: 1px solid ${borderColor};">
                    <tr>
                      <td style="padding: 25px;">
                        <h2 style="margin: 0 0 20px 0; font-size: 18px; color: ${textColor}; font-weight: 600;">Appointment Details</h2>

                        <table width="100%" border="0" cellspacing="0" cellpadding="8">
                          <tr>
                            <td style="font-size: 14px; color: #6b7280; width: 120px;">Service:</td>
                            <td style="font-size: 14px; color: ${textColor}; font-weight: 500;">${params.serviceName}</td>
                          </tr>
                          <tr>
                            <td style="font-size: 14px; color: #6b7280;">Stylist:</td>
                            <td style="font-size: 14px; color: ${textColor}; font-weight: 500;">${params.stylistName}</td>
                          </tr>
                          <tr>
                            <td style="font-size: 14px; color: #6b7280;">Date:</td>
                            <td style="font-size: 14px; color: ${textColor}; font-weight: 500;">${params.appointmentDate}</td>
                          </tr>
                          <tr>
                            <td style="font-size: 14px; color: #6b7280;">Time:</td>
                            <td style="font-size: 14px; color: ${textColor}; font-weight: 500;">${params.appointmentTime}</td>
                          </tr>
                          <tr>
                            <td style="font-size: 14px; color: #6b7280;">Duration:</td>
                            <td style="font-size: 14px; color: ${textColor}; font-weight: 500;">${params.duration} minutes</td>
                          </tr>
                          <tr>
                            <td style="font-size: 14px; color: #6b7280; padding-top: 10px; border-top: 1px solid ${borderColor};">Price:</td>
                            <td style="font-size: 16px; color: ${primaryColor}; font-weight: bold; padding-top: 10px; border-top: 1px solid ${borderColor};">$${params.price.toFixed(2)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Important Info -->
              <tr>
                <td style="padding: 20px 40px;">
                  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
                      <strong>Please arrive 10 minutes early</strong> to ensure we can start your appointment on time.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; border-top: 1px solid ${borderColor}; text-align: center;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                    Need to reschedule? Please call us or visit our website.
                  </p>
                  ${params.storefrontName ? `<p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">${params.storefrontName}${process.env.SMTP_STORE_LINK ? ` | ${process.env.SMTP_STORE_LINK}` : ""}</p>` : ""}
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendAppointmentConfirmation(params) {
  if (!hasSmtpConfiguration()) return;
  try {
    const info = await transport.sendMail({
      to: params.to,
      from: process.env.SMTP_FROM,
      subject: `Appointment Confirmed - ${params.appointmentDate} at ${params.appointmentTime}`,
      html: appointmentConfirmationEmail(params)
    });
    if (process.env.SMTP_USER?.includes("ethereal.email")) {
      console.log(`\u{1F4E7} Appointment confirmation sent! Preview: ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
    }
  } catch (error) {
    console.error("Failed to send appointment confirmation email:", error);
    throw error;
  }
}
function giftCardEmail(params) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const primaryColor = `hsl(${params.themeHue} 45% 38%)`;
  const secondaryColor = `hsl(${params.themeHue} 45% 58%)`;
  return `
    <body style="background: ${backgroundColor}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: ${backgroundColor}; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" border="0" cellspacing="0" cellpadding="0" style="background: ${mainBackgroundColor}; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); border-radius: 12px 12px 0 0;">
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
                  ${process.env.SMTP_STORE_LINK ? `<div style="margin-top: 20px; text-align: center;"><a href="${process.env.SMTP_STORE_LINK}/book" style="display: inline-block; padding: 15px 30px; background: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Book Your Appointment</a></div>` : ""}
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

// features/keystone/lib/storefrontBranding.ts
async function getStorefrontMessageBrand(context) {
  const rows = await context.sudo().query.StoreSettings.findMany({
    where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
    take: 2,
    orderBy: { createdAt: "asc" },
    query: "name themeHue primaryLocation { id isActive }"
  });
  if (rows.length !== 1 || !rows[0].primaryLocation?.id || rows[0].primaryLocation.isActive !== true) {
    return { name: null, themeHue: UNCONFIGURED_STOREFRONT_HUE };
  }
  const name = typeof rows[0].name === "string" ? rows[0].name.trim() : "";
  return { name: name || null, themeHue: safeStorefrontHue(rows[0].themeHue) };
}

// features/keystone/mutations/purchaseGiftCard.ts
function giftCardCode(idempotencyKey) {
  const compact = (0, import_node_crypto3.createHash)("sha256").update(idempotencyKey).digest("hex").slice(0, 12).toUpperCase();
  return compact.match(/.{1,4}/g).join("-");
}
function paymentOperator2(context) {
  return permissions.canManagePayments({ session: context.session });
}
function validKey(value) {
  return value.trim().length >= 12 && value.length <= 200;
}
function safeError2(error) {
  const message = error instanceof Error ? error.message : "Gift-card payment operation failed";
  if (/^(Gift card|Payment|Provider|Purchaser|Idempotency|Invalid payment transition)/.test(message)) return message;
  console.error("Gift-card payment workflow failed:", error);
  return "Gift-card payment operation failed";
}
async function defaultProvider(sudo, providerCode) {
  const providers = await sudo.query.PaymentProvider.findMany({
    where: providerCode ? { code: { equals: providerCode }, isInstalled: { equals: true } } : { isInstalled: { equals: true }, isDefault: { equals: true } },
    take: 1,
    query: "id code adapter config"
  });
  if (!providers[0]) throw new Error("Payment provider is unavailable");
  return providers[0];
}
async function purchaseGiftCardTransaction(context, args) {
  const denied11 = { success: false, giftCardId: null, paymentSessionId: null, clientSecret: null };
  if (!paymentOperator2(context)) return { ...denied11, error: "You must have payment authority" };
  if (!Number.isInteger(args.amount) || args.amount < 2500 || args.amount > 5e4) return { ...denied11, error: "Gift card amount must be between $25 and $500" };
  if (!validKey(args.idempotencyKey)) return { ...denied11, error: "Idempotency key is invalid" };
  const purchaserEmail = args.purchaserEmail.trim().toLowerCase();
  const recipientEmail = (args.recipientEmail || purchaserEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return { ...denied11, error: "Gift card email is invalid" };
  if (args.purchaserName.trim().length > 120 || (args.recipientName?.length || 0) > 120 || (args.message?.length || 0) > 2e3) return { ...denied11, error: "Gift card details are too long" };
  try {
    return await serializableWorkflow(context, "salon-gift-card", [`purchase:${args.idempotencyKey}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        take: 1,
        query: "id amount data"
      }))[0];
      if (existing) {
        const data = existing.data && typeof existing.data === "object" ? existing.data : {};
        if (data.purpose !== "gift_card" || existing.amount !== args.amount) throw new Error("Idempotency key was already used for another operation");
        return { success: true, giftCardId: data.giftCardId || null, paymentSessionId: existing.id, clientSecret: data.clientSecret || null, error: null };
      }
      const purchaser = (await sudo.query.User.findMany({ where: { email: { equals: purchaserEmail } }, take: 1, query: "id" }))[0];
      if (!purchaser) throw new Error("Purchaser must have an authenticated client account");
      const provider = await defaultProvider(sudo, args.providerCode);
      if (provider.adapter !== "manual") throw new Error("Provider online gift-card collection is unavailable; use collected tender");
      const adapter = await createProviderPaymentSession({
        provider: paymentProviderFromRecord(provider),
        amount: args.amount,
        currency: "usd",
        idempotencyKey: args.idempotencyKey,
        metadata: { purpose: "gift_card", purchaserId: purchaser.id }
      });
      const expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      const completed = adapter.status === "completed";
      const giftCard = await sudo.query.GiftCard.createOne({
        data: {
          code: giftCardCode(args.idempotencyKey),
          initialValue: args.amount,
          currentBalance: args.amount,
          recipientEmail,
          recipientName: args.recipientName?.trim() || args.purchaserName.trim(),
          message: args.message?.trim() || "",
          expiresAt: expiresAt.toISOString(),
          isActive: completed,
          purchasedBy: { connect: { id: purchaser.id } }
        },
        query: "id"
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const session = await sudo.query.PaymentSession.createOne({
        data: {
          provider: { connect: { id: provider.id } },
          idempotencyKey: args.idempotencyKey,
          amount: args.amount,
          currency: "usd",
          status: adapter.status,
          providerReference: adapter.providerReference,
          completedAt: completed ? now : void 0,
          data: { ...adapter.data || {}, purpose: "gift_card", clientSecret: adapter.clientSecret || null, giftCardId: giftCard.id }
        },
        query: "id"
      });
      const payment = await sudo.query.Payment.createOne({
        data: {
          subtotal: args.amount,
          tax: 0,
          tip: 0,
          discount: 0,
          totalAmount: args.amount,
          paymentMethod: "credit_card",
          status: paymentRecordStatus(adapter.status),
          session: { connect: { id: session.id } },
          processedBy: { connect: { id: context.session.itemId } },
          processedAt: completed ? now : void 0,
          receiptEmail: purchaserEmail,
          notes: `Gift-card purchase ${giftCard.id}`
        },
        query: "id"
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
      if (completed) {
        await sudo.query.GiftCardTransaction.createOne({
          data: { giftCard: { connect: { id: giftCard.id } }, type: "purchase", amount: args.amount, idempotencyKey: `${args.idempotencyKey}:purchase`, notes: `provider:${provider.code}` },
          query: "id"
        });
      }
      return { success: true, giftCardId: giftCard.id, paymentSessionId: session.id, clientSecret: adapter.clientSecret || null, error: null };
    });
  } catch (error) {
    return { ...denied11, error: safeError2(error) };
  }
}
var purchaseGiftCard = import_core61.graphql.field({
  type: import_core61.graphql.object()({
    name: "PurchaseGiftCardResult",
    fields: {
      success: import_core61.graphql.field({ type: import_core61.graphql.nonNull(import_core61.graphql.Boolean) }),
      giftCardId: import_core61.graphql.field({ type: import_core61.graphql.String }),
      paymentSessionId: import_core61.graphql.field({ type: import_core61.graphql.String }),
      clientSecret: import_core61.graphql.field({ type: import_core61.graphql.String }),
      error: import_core61.graphql.field({ type: import_core61.graphql.String })
    }
  }),
  args: {
    amount: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.Int) }),
    recipientEmail: import_core61.graphql.arg({ type: import_core61.graphql.String }),
    recipientName: import_core61.graphql.arg({ type: import_core61.graphql.String }),
    message: import_core61.graphql.arg({ type: import_core61.graphql.String }),
    purchaserEmail: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.String) }),
    purchaserName: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.String) }),
    providerCode: import_core61.graphql.arg({ type: import_core61.graphql.String }),
    idempotencyKey: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.String) })
  },
  resolve(_source, args, context) {
    return purchaseGiftCardTransaction(context, args);
  }
});
async function confirmGiftCardPurchaseTransaction(context, paymentSessionId) {
  if (!paymentOperator2(context)) return { success: false, error: "You must have payment authority", code: null };
  try {
    const result2 = await serializableWorkflow(context, "salon-gift-card", [`session:${paymentSessionId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const session = await sudo.query.PaymentSession.findOne({
        where: { id: paymentSessionId },
        query: "id status providerReference idempotencyKey amount data payment { id } provider { code adapter config }"
      });
      if (!session?.provider || !session.providerReference || !session.payment) throw new Error("Payment session not found");
      const data = session.data && typeof session.data === "object" ? session.data : {};
      if (data.purpose !== "gift_card" || !data.giftCardId) throw new Error("Gift card session is invalid");
      const giftCard = await sudo.query.GiftCard.findOne({ where: { id: data.giftCardId }, query: "id code initialValue recipientEmail recipientName isActive" });
      if (!giftCard) throw new Error("Gift card not found");
      if (session.status === "completed" && giftCard.isActive) return { code: giftCard.code, email: null };
      assertPaymentTransition(session.status, "completed");
      if (session.provider.adapter !== "manual") throw new Error("Provider online gift-card confirmation is unavailable");
      const providerResult = await confirmProviderPayment({
        provider: paymentProviderFromRecord(session.provider),
        providerReference: session.providerReference,
        amount: session.amount,
        idempotencyKey: `${session.idempotencyKey}:confirm`
      });
      assertPaymentTransition(session.status, providerResult.status);
      if (providerResult.status !== "completed") throw new Error("Provider has not completed the payment");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { status: "completed", completedAt: now, data: { ...data, ...providerResult.data || {} } }, query: "id" });
      await sudo.query.Payment.updateOne({ where: { id: session.payment.id }, data: { status: "completed", processedAt: now }, query: "id" });
      await sudo.query.GiftCard.updateOne({ where: { id: giftCard.id }, data: { isActive: true }, query: "id" });
      const existingPurchase = (await sudo.query.GiftCardTransaction.findMany({ where: { idempotencyKey: { equals: `${session.idempotencyKey}:purchase` } }, take: 1, query: "id" }))[0];
      if (!existingPurchase) {
        await sudo.query.GiftCardTransaction.createOne({
          data: { giftCard: { connect: { id: giftCard.id } }, type: "purchase", amount: giftCard.initialValue, idempotencyKey: `${session.idempotencyKey}:purchase`, notes: `provider:${session.provider.code}` },
          query: "id"
        });
      }
      return {
        code: giftCard.code,
        email: giftCard.recipientEmail ? { to: giftCard.recipientEmail, recipientName: giftCard.recipientName || "There", amount: giftCard.initialValue / 100, code: giftCard.code || "" } : null
      };
    });
    if (result2.email && process.env.NODE_ENV !== "test") {
      try {
        const messageBrand = await getStorefrontMessageBrand(context);
        await sendGiftCardEmail({ ...result2.email, senderName: "A client", storefrontName: messageBrand.name, themeHue: messageBrand.themeHue });
      } catch (error) {
        console.error("Gift card email failed:", error);
      }
    }
    return { success: true, error: null, code: result2.code };
  } catch (error) {
    return { success: false, error: safeError2(error), code: null };
  }
}
var confirmGiftCardPurchase = import_core61.graphql.field({
  type: import_core61.graphql.object()({
    name: "ConfirmGiftCardPurchaseResult",
    fields: { success: import_core61.graphql.field({ type: import_core61.graphql.nonNull(import_core61.graphql.Boolean) }), error: import_core61.graphql.field({ type: import_core61.graphql.String }), code: import_core61.graphql.field({ type: import_core61.graphql.String }) }
  }),
  args: { paymentSessionId: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.ID) }) },
  resolve(_source, { paymentSessionId }, context) {
    return confirmGiftCardPurchaseTransaction(context, paymentSessionId);
  }
});
async function applyGiftCardBalanceTransaction(context, args) {
  const denied11 = { success: false, giftCardId: null, transactionId: null, currentBalance: null };
  if (args.action === "refund") {
    if (!permissions.canIssueRefunds({ session: context.session })) return { ...denied11, error: "You must have refund authority" };
  } else if (!paymentOperator2(context)) {
    return { ...denied11, error: "You must have payment authority" };
  }
  if (!(/* @__PURE__ */ new Set(["redemption", "refund"])).has(args.action)) return { ...denied11, error: "Gift card action is invalid" };
  if (!Number.isInteger(args.amount) || args.amount <= 0 || args.amount > 1e7) return { ...denied11, error: "Gift card amount must be positive integer cents" };
  if (!validKey(args.idempotencyKey)) return { ...denied11, error: "Idempotency key is invalid" };
  if ((args.reason?.length || 0) > 1e3) return { ...denied11, error: "Gift card reason is too long" };
  try {
    return await serializableWorkflow(context, "salon-gift-card", [`card:${args.giftCardId}`, `balance:${args.idempotencyKey}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.GiftCardTransaction.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        take: 1,
        query: "id type amount giftCard { id currentBalance } appointment { id }"
      }))[0];
      if (existing) {
        if (existing.giftCard?.id !== args.giftCardId || existing.type !== args.action || Math.abs(existing.amount) !== args.amount || (existing.appointment?.id || null) !== (args.appointmentId || null)) {
          throw new Error("Idempotency key was already used for another gift card operation");
        }
        return { success: true, giftCardId: args.giftCardId, transactionId: existing.id, currentBalance: existing.giftCard.currentBalance, error: null };
      }
      const giftCard = await sudo.query.GiftCard.findOne({ where: { id: args.giftCardId }, query: "id initialValue currentBalance isActive expiresAt" });
      if (!giftCard) throw new Error("Gift card not found");
      if (giftCard.expiresAt && new Date(giftCard.expiresAt).getTime() <= Date.now()) throw new Error("Gift card has expired");
      if (args.action === "redemption" && (!giftCard.isActive || giftCard.currentBalance < args.amount)) throw new Error("Gift card has insufficient available balance");
      if (args.action === "refund" && giftCard.currentBalance + args.amount > giftCard.initialValue) throw new Error("Gift card refund exceeds its original value");
      if (args.appointmentId) {
        const appointment = await sudo.query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id status" });
        if (!appointment) throw new Error("Gift card appointment not found");
      }
      const currentBalance = args.action === "redemption" ? giftCard.currentBalance - args.amount : giftCard.currentBalance + args.amount;
      const transaction = await sudo.query.GiftCardTransaction.createOne({
        data: {
          giftCard: { connect: { id: giftCard.id } },
          type: args.action,
          amount: args.action === "redemption" ? -args.amount : args.amount,
          appointment: args.appointmentId ? { connect: { id: args.appointmentId } } : void 0,
          idempotencyKey: args.idempotencyKey,
          notes: args.reason?.trim() || ""
        },
        query: "id"
      });
      await sudo.query.GiftCard.updateOne({ where: { id: giftCard.id }, data: { currentBalance, isActive: currentBalance > 0 }, query: "id" });
      return { success: true, giftCardId: giftCard.id, transactionId: transaction.id, currentBalance, error: null };
    });
  } catch (error) {
    return { ...denied11, error: safeError2(error) };
  }
}
var applyGiftCardBalance = import_core61.graphql.field({
  type: import_core61.graphql.object()({
    name: "ApplyGiftCardBalanceResult",
    fields: {
      success: import_core61.graphql.field({ type: import_core61.graphql.nonNull(import_core61.graphql.Boolean) }),
      giftCardId: import_core61.graphql.field({ type: import_core61.graphql.ID }),
      transactionId: import_core61.graphql.field({ type: import_core61.graphql.ID }),
      currentBalance: import_core61.graphql.field({ type: import_core61.graphql.Int }),
      error: import_core61.graphql.field({ type: import_core61.graphql.String })
    }
  }),
  args: {
    giftCardId: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.ID) }),
    action: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.String) }),
    amount: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.Int) }),
    appointmentId: import_core61.graphql.arg({ type: import_core61.graphql.ID }),
    reason: import_core61.graphql.arg({ type: import_core61.graphql.String }),
    idempotencyKey: import_core61.graphql.arg({ type: import_core61.graphql.nonNull(import_core61.graphql.String) })
  },
  resolve(_source, args, context) {
    return applyGiftCardBalanceTransaction(context, args);
  }
});
var giftCardMutations = { purchaseGiftCard, confirmGiftCardPurchase, applyGiftCardBalance };

// features/keystone/mutations/bookAppointment.ts
var import_node_crypto4 = require("node:crypto");
var import_core62 = require("@keystone-6/core");

// features/keystone/serviceSnapshot.ts
function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function nonnegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Service snapshot price must be nonnegative integer cents");
  return parsed;
}
function canonicalImagePath(value) {
  if (typeof value !== "string") return "";
  const path = value.trim();
  return path.startsWith("/images/") && !path.includes("..") ? path : "";
}
function captureServiceSnapshot(service) {
  const serviceTitle = typeof service.name === "string" ? service.name.trim() : "";
  if (!serviceTitle || serviceTitle.length > 300) throw new Error("Service snapshot title is invalid");
  const serviceImagePath = canonicalImagePath(service.image?.imagePath) || canonicalImagePath(service.image?.image?.url);
  return {
    serviceTitle,
    serviceImagePath,
    duration: positiveInteger(service.baseDuration ?? service.duration, 60),
    price: nonnegativeInteger(service.price ?? service.basePrice ?? 0)
  };
}

// features/keystone/bookingPolicy.ts
function bookingPolicy() {
  const cancellationNoticeMinutes = Number(process.env.CLIENT_CANCELLATION_NOTICE_MINUTES || 1440);
  const rescheduleNoticeMinutes = Number(process.env.CLIENT_RESCHEDULE_NOTICE_MINUTES || 1440);
  if (![cancellationNoticeMinutes, rescheduleNoticeMinutes].every((value) => Number.isInteger(value) && value >= 0 && value <= 525600)) throw new Error("Booking policy configuration is invalid");
  return { version: process.env.CLIENT_BOOKING_POLICY_VERSION || "salon-booking-v2", cancellationNoticeMinutes, rescheduleNoticeMinutes };
}
function hasCurrentBookingPolicyAffirmation(accepted, submittedVersion, currentVersion) {
  return accepted === true && submittedVersion === currentVersion;
}
function isPolicyDeadlineOpen(deadline, now = Date.now()) {
  if (typeof deadline !== "string" || !/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(deadline)) return false;
  const deadlineAt = Date.parse(deadline);
  return Number.isFinite(deadlineAt) && deadlineAt > now;
}

// features/keystone/serviceStatus.ts
function isActiveServiceStatus(status) {
  return status === "active";
}

// features/keystone/bookingRecovery.ts
var BOOKING_RECOVERY_DELAYS_MS = [0, 50, 150];
var BOOKING_REQUEST_KEY_CONFLICT = "Booking request key was reused with different details";
var BOOKING_OUTCOME_UNRESOLVED = "Booking outcome could not be verified. Retry with the same request key.";
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function classifyBookingRecoveryRecord(record, requestHash) {
  if (record === null) return { status: "absent" };
  if (!isRecord(record) || typeof record.id !== "string" || !record.id.trim() || record.id !== record.id.trim() || !isRecord(record.metadata) || typeof record.metadata.bookingRequestHash !== "string") return { status: "unresolved" };
  return record.metadata.bookingRequestHash === requestHash ? { status: "accepted", appointmentId: record.id } : { status: "conflict" };
}
async function recoverBookingByIdempotency(context, requestKey, requestHash, delaysMs = BOOKING_RECOVERY_DELAYS_MS) {
  let successfulAbsentReads = 0;
  const attempts = delaysMs.slice(0, BOOKING_RECOVERY_DELAYS_MS.length);
  if (attempts.length === 0) return { status: "unresolved" };
  for (const delayMs of attempts) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const record = await context.transaction(async (transactionContext) => {
        await transactionContext.prisma.$executeRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
          "salon-booking-request",
          requestKey
        );
        return transactionContext.prisma.appointment.findFirst({
          where: { metadata: { path: ["bookingRequestKey"], equals: requestKey } },
          select: { id: true, metadata: true }
        });
      }, { maxWait: 5e3, timeout: 5e3 });
      const result2 = classifyBookingRecoveryRecord(record, requestHash);
      if (result2.status !== "absent") return result2;
      successfulAbsentReads += 1;
    } catch {
    }
  }
  return successfulAbsentReads === attempts.length ? { status: "absent" } : { status: "unresolved" };
}

// features/keystone/scheduling/occupancy.ts
var BOOKING_BUFFER_MINUTES = 15;
var ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"];
var ACTIVE_SEGMENT_STATUSES = ["planned", "started"];
var MINUTE_MS = 6e4;
function scheduleIntervalsOverlapWithBuffer(startA, endA, startB, endB, bufferMinutes = BOOKING_BUFFER_MINUTES) {
  const bufferMs = bufferMinutes * MINUTE_MS;
  return startA < endB + bufferMs && startB < endA + bufferMs;
}
function validInterval(start, end) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
    throw new Error("Resource schedule interval is invalid");
  }
}
function countResourceOccupancyUnits({
  resourceId,
  start,
  end,
  appointments,
  segments,
  bufferMinutes = BOOKING_BUFFER_MINUTES
}) {
  validInterval(start, end);
  const candidateStart = start.getTime();
  const candidateEnd = end.getTime();
  let occupiedUnits = 0;
  for (const appointment of appointments) {
    if (appointment.resource?.id !== resourceId || appointment.segments?.length) continue;
    const appointmentStart = Date.parse(appointment.startTime);
    const persistedEnd = appointment.endTime ? Date.parse(appointment.endTime) : Number.NaN;
    const duration = Number(appointment.duration);
    const appointmentEnd = Number.isFinite(persistedEnd) ? persistedEnd : appointmentStart + (Number.isFinite(duration) && duration > 0 ? duration : 0) * MINUTE_MS;
    if (!Number.isFinite(appointmentStart) || !Number.isFinite(appointmentEnd) || appointmentEnd <= appointmentStart) {
      throw new Error("Resource appointment occupancy evidence is invalid");
    }
    if (scheduleIntervalsOverlapWithBuffer(candidateStart, candidateEnd, appointmentStart, appointmentEnd, bufferMinutes)) occupiedUnits += 1;
  }
  for (const segment of segments) {
    if (segment.resource?.id !== resourceId) continue;
    const segmentStart = Date.parse(segment.plannedStart);
    const segmentEnd = Date.parse(segment.plannedEnd);
    const units2 = Number(segment.resourceUnits ?? 1);
    if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd) || segmentEnd <= segmentStart || !Number.isInteger(units2) || units2 < 1) {
      throw new Error("Resource segment occupancy evidence is invalid");
    }
    if (scheduleIntervalsOverlapWithBuffer(candidateStart, candidateEnd, segmentStart, segmentEnd, bufferMinutes)) occupiedUnits += units2;
  }
  return occupiedUnits;
}
function resourceCapacityAvailable({
  resourceId,
  capacity,
  start,
  end,
  appointments,
  segments,
  requestedUnits = 1
}) {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(requestedUnits) || requestedUnits < 1) {
    throw new Error("Resource capacity evidence is invalid");
  }
  return countResourceOccupancyUnits({ resourceId, start, end, appointments, segments }) + requestedUnits <= capacity;
}
async function isResourceAllocationAvailable(sudo, {
  resourceId,
  locationId,
  start,
  end,
  requestedUnits = 1,
  excludeAppointmentId
}) {
  validInterval(start, end);
  const resource = await sudo.query.SalonResource.findOne({
    where: { id: resourceId },
    query: "id capacity isActive location { id }"
  });
  if (!resource || !resource.isActive || resource.location?.id !== locationId) {
    throw new Error("Resource is not available at the appointment location");
  }
  const capacity = Number(resource.capacity || 1);
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(requestedUnits) || requestedUnits < 1) {
    throw new Error("Resource capacity evidence is invalid");
  }
  const bufferMs = BOOKING_BUFFER_MINUTES * MINUTE_MS;
  const windowStart = new Date(start.getTime() - bufferMs).toISOString();
  const windowEnd = new Date(end.getTime() + bufferMs).toISOString();
  const appointmentWhere = {
    resource: { id: { equals: resourceId } },
    startTime: { lt: windowEnd },
    OR: [{ endTime: { gt: windowStart } }, { endTime: null }],
    status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    ...excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}
  };
  const appointments = await sudo.query.Appointment.findMany({
    where: appointmentWhere,
    take: 2e3,
    query: "id startTime endTime duration resource { id } segments(where: { status: { in: [planned, started] } }) { id }"
  });
  const segments = await sudo.query.AppointmentSegment.findMany({
    where: {
      resource: { id: { equals: resourceId } },
      appointment: {
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        ...excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}
      },
      status: { in: [...ACTIVE_SEGMENT_STATUSES] },
      plannedStart: { lt: windowEnd },
      plannedEnd: { gt: windowStart }
    },
    take: 5e3,
    query: "id plannedStart plannedEnd resourceUnits resource { id }"
  });
  if (appointments.length >= 2e3 || segments.length >= 5e3) {
    throw new Error("Resource schedule is too large to safely evaluate; narrow the operating window");
  }
  return resourceCapacityAvailable({
    resourceId,
    capacity,
    start,
    end,
    appointments,
    segments,
    requestedUnits
  });
}

// features/keystone/scheduling/resource-requirements.ts
function missingRequiredServiceResourceIds(requiredResources, assignedResourceIds) {
  const assigned = new Set(assignedResourceIds);
  return [...new Set(requiredResources.map((resource) => resource.id))].filter((id) => !assigned.has(id));
}
function resolveBookableServiceResource(services, locationId) {
  const constrained = services.filter((service) => (service.requiredResources?.length || 0) > 0);
  if (!constrained.length) return null;
  const selected = [];
  for (const service of constrained) {
    const resources = service.requiredResources || [];
    if (resources.length !== 1) {
      throw new Error(`${service.name || "Selected service"} requires multiple resource assignments; contact the salon to schedule`);
    }
    const resource = resources[0];
    if (!resource?.id || !resource.isActive || resource.location?.id !== locationId) {
      throw new Error(`${service.name || "Selected service"} has no active required resource at this location`);
    }
    selected.push(resource);
  }
  const resourceIds = new Set(selected.map((resource) => resource.id));
  if (resourceIds.size !== 1) {
    throw new Error("Selected services require separate resource assignments; contact the salon to schedule");
  }
  return selected[0];
}

// features/keystone/scheduling/availability.ts
var SLOT_INTERVAL_MINUTES = 30;
var ACTIVE_APPOINTMENT_STATUSES2 = ["pending", "confirmed", "in_progress"];
var DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function assertDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Availability date is invalid");
  const date2 = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date2.getTime()) || date2.toISOString().slice(0, 10) !== value) throw new Error("Availability date is invalid");
  return value;
}
function timeToMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Schedule time must use HH:MM");
  return Number(match[1]) * 60 + Number(match[2]);
}
function timeLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, "0")} ${period}`;
}
function validTimeZone(value) {
  const timezone = typeof value === "string" && value.trim() ? value.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(/* @__PURE__ */ new Date());
    return timezone;
  } catch {
    throw new Error("Salon timezone is invalid");
  }
}
function wallParts(date2, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short"
  }).formatToParts(date2);
  const value = (type) => parts.find((part) => part.type === type)?.value || "0";
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    second: Number(value("second")),
    weekday: weekdays[value("weekday")] ?? 0
  };
}
function zonedDateKey(date2, timezone) {
  const parts = wallParts(date2, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
function withinLocationHours(hours, weekday, startMinute, endMinute) {
  const hourRecords = hours && typeof hours === "object" ? hours : {};
  const opening = hourRecords[DAY_KEYS[weekday]];
  if (!opening) return true;
  if (opening.closed) return false;
  if (opening.open && startMinute < timeToMinutes(opening.open)) return false;
  if (opening.close && endMinute > timeToMinutes(opening.close)) return false;
  return true;
}
function isLocationOpenForInterval(hours, timezone, start, end) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) return false;
  const salonTimezone = validTimeZone(timezone);
  const startParts = wallParts(start, salonTimezone);
  const endParts = wallParts(end, salonTimezone);
  const dateKey2 = `${startParts.year}-${String(startParts.month).padStart(2, "0")}-${String(startParts.day).padStart(2, "0")}`;
  const endDateKey = `${endParts.year}-${String(endParts.month).padStart(2, "0")}-${String(endParts.day).padStart(2, "0")}`;
  if (dateKey2 !== endDateKey) return false;
  const startMinute = startParts.hour * 60 + startParts.minute + (startParts.second + start.getUTCMilliseconds() / 1e3) / 60;
  const endMinute = endParts.hour * 60 + endParts.minute + (endParts.second + end.getUTCMilliseconds() / 1e3) / 60;
  return withinLocationHours(hours, startParts.weekday, startMinute, endMinute);
}
function nextDateKey(dateKey2) {
  const date2 = /* @__PURE__ */ new Date(`${dateKey2}T00:00:00.000Z`);
  date2.setUTCDate(date2.getUTCDate() + 1);
  return date2.toISOString().slice(0, 10);
}
function zonedDateTimeToUtc(dateKey2, minutes, timezone) {
  assertDateKey(dateKey2);
  const [year, month, day] = dateKey2.split("-").map(Number);
  const desiredHour = Math.floor(minutes / 60);
  const desiredMinute = minutes % 60;
  const desiredWall = Date.UTC(year, month - 1, day, desiredHour, desiredMinute, 0, 0);
  let guess = desiredWall;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallParts(new Date(guess), timezone);
    const actualWall = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
    const correction = desiredWall - actualWall;
    guess += correction;
    if (correction === 0) break;
  }
  const result2 = new Date(guess);
  const verified = wallParts(result2, timezone);
  if (verified.year !== year || verified.month !== month || verified.day !== day || verified.hour !== desiredHour || verified.minute !== desiredMinute) {
    throw new Error("Selected local time does not exist in the salon timezone");
  }
  return result2;
}
function zonedDayWindow(dateKey2, timezone) {
  return {
    start: zonedDateTimeToUtc(dateKey2, 0, timezone),
    end: zonedDateTimeToUtc(nextDateKey(dateKey2), 0, timezone)
  };
}
function scheduleDateKey(schedule) {
  if (schedule.localDate && /^\d{4}-\d{2}-\d{2}$/.test(schedule.localDate)) return schedule.localDate;
  if (!schedule.date) return null;
  const date2 = new Date(schedule.date);
  return Number.isNaN(date2.getTime()) ? null : date2.toISOString().slice(0, 10);
}
function withinEffectiveRange(schedule, dateKey2) {
  const from = schedule.effectiveFrom ? new Date(schedule.effectiveFrom).toISOString().slice(0, 10) : null;
  const to = schedule.effectiveTo ? new Date(schedule.effectiveTo).toISOString().slice(0, 10) : null;
  return (!from || dateKey2 >= from) && (!to || dateKey2 <= to);
}
function overlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
function interval(schedule) {
  return { start: timeToMinutes(schedule.startTime), end: timeToMinutes(schedule.endTime) };
}
async function getRuntimeLocation(sudo, locationId) {
  if (locationId) {
    const location = await sudo.query.Location.findOne({ where: { id: locationId }, query: "id timezone isActive hours" });
    if (!location || location.isActive === false) throw new Error("Location is unavailable");
    return { locationId: location.id, timezone: validTimeZone(location.timezone), hours: location.hours };
  }
  const locations = await sudo.query.Location.findMany({
    where: { isActive: { equals: true } },
    orderBy: { createdAt: "asc" },
    take: 2,
    query: "id timezone hours"
  });
  if (locations.length !== 1) throw new Error(locations.length ? "Choose a salon location" : "No active salon location is configured");
  return { locationId: locations[0].id, timezone: validTimeZone(locations[0].timezone), hours: locations[0].hours };
}
async function computeStylistAvailability({
  sudo,
  stylistId,
  date: date2,
  serviceDuration,
  serviceIds = [],
  locationId: requestedLocationId,
  excludeAppointmentId,
  slotStepMinutes = SLOT_INTERVAL_MINUTES
}) {
  const dateKey2 = assertDateKey(date2);
  if (!Number.isInteger(serviceDuration) || serviceDuration < 1 || serviceDuration > 8 * 60) throw new Error("Service duration is invalid");
  const { locationId, timezone, hours } = await getRuntimeLocation(sudo, requestedLocationId);
  const localNoon = zonedDateTimeToUtc(dateKey2, 12 * 60, timezone);
  const requestedWeekday = wallParts(localNoon, timezone).weekday;
  const stylist = await sudo.query.Stylist.findOne({
    where: { id: stylistId },
    query: "id status isActive user { name } locations { id }"
  });
  if (!stylist || stylist.status !== "active" || stylist.isActive === false) throw new Error("Stylist is unavailable");
  if (!stylist.locations?.some((location) => location.id === locationId)) throw new Error("Stylist is not assigned to this location");
  const schedules = await sudo.query.StylistSchedule.findMany({
    where: { stylist: { id: { equals: stylistId } }, location: { id: { equals: locationId } } },
    take: 500,
    query: "id type dayOfWeek localDate date startTime endTime isAvailable breakStart breakEnd effectiveFrom effectiveTo reason"
  });
  const exact = schedules.filter((schedule) => scheduleDateKey(schedule) === dateKey2);
  const oneTimeAvailable = exact.filter((schedule) => schedule.type === "one_time" && schedule.isAvailable);
  const recurring = schedules.filter((schedule) => schedule.type === "recurring" && schedule.isAvailable && schedule.dayOfWeek === requestedWeekday && withinEffectiveRange(schedule, dateKey2));
  const availability = oneTimeAvailable.length ? oneTimeAvailable : recurring;
  const blocks = exact.filter((schedule) => schedule.type === "time_off" || schedule.type === "one_time" && !schedule.isAvailable);
  const { start: dayStart, end: dayEnd } = zonedDayWindow(dateKey2, timezone);
  const appointments = await sudo.query.Appointment.findMany({
    where: {
      stylist: { id: { equals: stylistId } },
      ...excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {},
      startTime: { lt: dayEnd.toISOString() },
      OR: [{ endTime: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 6e4).toISOString() } }, { endTime: null }],
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES2] }
    },
    take: 2e3,
    query: "id startTime duration segments(where: { status: { in: [planned, started] } }) { id }"
  });
  const resourceAppointments = await sudo.query.Appointment.findMany({
    where: {
      ...excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {},
      startTime: { lt: dayEnd.toISOString() },
      OR: [{ endTime: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 6e4).toISOString() } }, { endTime: null }],
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES2] }
    },
    take: 2e3,
    query: "id startTime endTime duration resource { id } segments(where: { status: { in: [planned, started] } }) { id }"
  });
  const segments = await sudo.query.AppointmentSegment.findMany({
    where: {
      appointment: { status: { in: [...ACTIVE_APPOINTMENT_STATUSES2] }, ...excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {} },
      status: { in: ["planned", "started"] },
      plannedStart: { lt: dayEnd.toISOString() },
      plannedEnd: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 6e4).toISOString() }
    },
    take: 5e3,
    query: "id plannedStart plannedEnd practitioner { id } resource { id } resourceUnits"
  });
  if (appointments.length >= 2e3 || resourceAppointments.length >= 2e3 || segments.length >= 5e3) throw new Error("Schedule is too large to safely evaluate; narrow the operating window");
  const services = serviceIds.length ? await sudo.query.Service.findMany({
    where: { id: { in: [...new Set(serviceIds)] }, status: { equals: "active" } },
    query: "id specialists { id } requiredResources { id name capacity isActive location { id } }"
  }) : [];
  if (serviceIds.length && services.length !== new Set(serviceIds).size) throw new Error("A selected service is unavailable");
  if (services.some((service) => !service.specialists.some((person) => person.id === stylistId))) throw new Error("Practitioner is not qualified for the selected service");
  const requiredResource = resolveBookableServiceResource(services, locationId);
  const requiredResources = requiredResource ? [requiredResource] : [];
  const candidateMinutes = /* @__PURE__ */ new Map();
  for (const schedule of availability) {
    const range = interval(schedule);
    if (range.end <= range.start) continue;
    for (let minutes = range.start; minutes + serviceDuration <= range.end; minutes += slotStepMinutes) {
      if (!candidateMinutes.has(minutes)) candidateMinutes.set(minutes, schedule);
    }
  }
  const slots = [];
  for (const [slotStart, schedule] of [...candidateMinutes.entries()].sort(([a], [b]) => a - b)) {
    const serviceEnd = slotStart + serviceDuration;
    let instant2;
    try {
      instant2 = zonedDateTimeToUtc(dateKey2, slotStart, timezone).getTime();
    } catch {
      continue;
    }
    if (instant2 <= Date.now() || instant2 > Date.now() + 366 * 864e5) continue;
    if (!withinLocationHours(hours, requestedWeekday, slotStart, serviceEnd)) continue;
    const instantEnd = instant2 + (serviceDuration + BOOKING_BUFFER_MINUTES) * 6e4;
    const reservedEnd = serviceEnd + BOOKING_BUFFER_MINUTES;
    const breakStart = schedule.breakStart ? timeToMinutes(schedule.breakStart) : null;
    const breakEnd = schedule.breakEnd ? timeToMinutes(schedule.breakEnd) : null;
    const duringBreak = breakStart !== null && breakEnd !== null && overlap(slotStart, reservedEnd, breakStart, breakEnd);
    const blockedSchedule = blocks.find((block) => {
      const range = interval(block);
      return overlap(slotStart, reservedEnd, range.start, range.end);
    });
    const appointmentConflict = appointments.some((appointment) => {
      if (appointment.segments?.length) return false;
      const appointmentStart = new Date(appointment.startTime).getTime();
      return overlap(instant2, instantEnd, appointmentStart, appointmentStart + (Number(appointment.duration || serviceDuration) + BOOKING_BUFFER_MINUTES) * 6e4);
    }) || segments.some((segment) => segment.practitioner?.id === stylistId && overlap(instant2, instantEnd, new Date(segment.plannedStart).getTime(), new Date(segment.plannedEnd).getTime() + BOOKING_BUFFER_MINUTES * 6e4));
    let selectedResource = null;
    if (requiredResources.length) {
      selectedResource = requiredResources.find((resource) => {
        return resourceCapacityAvailable({
          resourceId: resource.id,
          capacity: Number(resource.capacity || 1),
          start: new Date(instant2),
          end: new Date(instant2 + serviceDuration * 6e4),
          appointments: resourceAppointments,
          segments
        });
      }) || null;
    }
    const resourceBlocked = requiredResources.length > 0 && !selectedResource;
    const blockedReason = (blockedSchedule ? "Stylist unavailable" : null) || (duringBreak ? "Break time" : null) || (appointmentConflict ? "Selected stylist already has an appointment at that time" : null) || (resourceBlocked ? "Required room or equipment is unavailable at that time" : null);
    slots.push({
      time: timeLabel(slotStart),
      startTime: zonedDateTimeToUtc(dateKey2, slotStart, timezone).toISOString(),
      available: !blockedReason,
      resourceId: selectedResource?.id || null,
      resourceName: selectedResource?.name || null,
      blockedReason
    });
  }
  return {
    stylistId,
    stylistName: stylist.user?.name || "Salon provider",
    date: dateKey2,
    timezone,
    locationId,
    slots
  };
}

// features/keystone/mutations/bookAppointment.ts
var CAPACITY_RECHECK_DELAYS_MS = [0, 50, 150];
var STYLIST_OCCUPIED_REASON = "Selected stylist already has an appointment at that time";
var RESOURCE_UNAVAILABLE_REASON = "Required room or equipment is unavailable at that time";
var BookAppointmentResult = import_core62.graphql.object()({
  name: "BookAppointmentResult",
  fields: {
    success: import_core62.graphql.field({ type: import_core62.graphql.nonNull(import_core62.graphql.Boolean) }),
    appointmentId: import_core62.graphql.field({ type: import_core62.graphql.ID }),
    error: import_core62.graphql.field({ type: import_core62.graphql.String })
  }
});
function servicePriceCents(service) {
  if (typeof service.price === "number") return service.price;
  return Number(service.basePrice || 0);
}
function guestPassword() {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
async function resolveAuthorizedClient(sudo, input, sessionUserId, isOperator2 = false) {
  if (!sessionUserId && !isOperator2) return null;
  let user = sessionUserId ? await sudo.query.User.findOne({ where: { id: sessionUserId }, query: "id name email phone" }) : await sudo.query.User.findOne({ where: { email: input.email }, query: "id name email phone" });
  if (sessionUserId && user?.email?.toLowerCase() !== input.email) {
    throw new Error("Use the email address on your signed-in account");
  }
  if (!user && isOperator2) {
    user = await sudo.query.User.createOne({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || "",
        password: guestPassword()
      },
      query: "id name email phone"
    });
  }
  if (!user) throw new Error("Signed-in client account could not be found");
  const existingClients = await sudo.query.Client.findMany({
    where: { user: { id: { equals: user.id } } },
    take: 1,
    query: "id user { id name email phone }"
  });
  if (existingClients[0]) return existingClients[0];
  return sudo.query.Client.createOne({
    data: {
      user: { connect: { id: user.id } },
      firstVisit: (/* @__PURE__ */ new Date()).toISOString(),
      totalVisits: 0,
      lifetimeValue: 0
    },
    query: "id user { id name email phone }"
  });
}
async function lockBookingCapacity(context, stylistId, services) {
  const keys = [
    `stylist:${stylistId}`,
    ...services.flatMap((service) => service.requiredResources || []).map((resource) => `resource:${resource.id}`)
  ];
  for (const key of [...new Set(keys)].sort()) {
    await context.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "salon-appointment-capacity",
      key
    );
  }
}
var BookingOperatorDenied = class extends Error {
};
async function assertFreshBookingOperator(context) {
  const denied11 = () => new BookingOperatorDenied("You must be an authorized salon operator");
  const itemId = context.session?.itemId;
  if (typeof itemId !== "string" || !itemId || context.session?.listKey !== "User") throw denied11();
  const actor = await context.query.User.findOne({
    where: { id: itemId },
    query: "id role { id name canManageSalon canManageAppointments }"
  });
  if (!actor || actor.id !== itemId || !actor.role) throw denied11();
  const session = { ...context.session, data: { ...context.session.data, role: actor.role } };
  if (!permissions.canManageAppointments({ session })) throw denied11();
}
async function serializable(context, work) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.transaction(async (tx) => {
        await acquireSalonCapacityFence(tx);
        await assertCurrentWorkflowAuthority(tx);
        return work(tx);
      }, {
        maxWait: 5e3,
        timeout: 15e3,
        isolationLevel: "Serializable"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error?.code === "P2034" || error?.code === "40001" || error?.meta?.code === "40001" || /write conflict|deadlock|please retry your transaction/i.test(message);
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to reserve appointment capacity");
}
async function loadServices(sudo, serviceIds) {
  const services = await sudo.query.Service.findMany({
    where: { id: { in: serviceIds } },
    query: `
      id
      name
      status
      baseDuration
      basePrice
      price
      depositAmount
      requiresConsultation
      requiresPatchTest
      image { imagePath image { url } }
      specialists { id }
      requiredResources {
        id
        name
        capacity
      }
    `
  });
  if (services.length !== new Set(serviceIds).size) {
    throw new Error("One or more selected services could not be found");
  }
  const inactiveService = services.find((service) => !isActiveServiceStatus(service.status));
  if (inactiveService) {
    throw new Error(`${inactiveService.name || "Selected service"} is not currently bookable`);
  }
  return services;
}
function originalBookingError(error) {
  return error instanceof Error ? error.message : "Unable to book appointment";
}
function opaqueAppointmentLifecycleError(error) {
  return /Appointment\.hooks\.afterOperation: appointment lifecycle event is missing its aggregate id/i.test(originalBookingError(error));
}
function authoritativeBookingCapacityReason(slots, requestedStart) {
  const exactSlot = slots.find((slot) => new Date(slot.startTime).getTime() === requestedStart.getTime());
  if (exactSlot?.available) return null;
  return exactSlot?.blockedReason === STYLIST_OCCUPIED_REASON || exactSlot?.blockedReason === RESOURCE_UNAVAILABLE_REASON ? exactSlot.blockedReason : null;
}
function classifiedBookingError(error, capacityReason) {
  if (!opaqueAppointmentLifecycleError(error)) return originalBookingError(error);
  return capacityReason === STYLIST_OCCUPIED_REASON || capacityReason === RESOURCE_UNAVAILABLE_REASON ? capacityReason : originalBookingError(error);
}
async function recheckFailedBookingCapacity(context, request, delaysMs = CAPACITY_RECHECK_DELAYS_MS) {
  for (const delayMs of delaysMs.slice(0, CAPACITY_RECHECK_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const sudo = context.sudo();
      const services = await loadServices(sudo, request.serviceIds);
      const duration = services.reduce((sum, service) => sum + Number(service.baseDuration || 0), 0) || 60;
      const location = await getRuntimeLocation(sudo, request.locationId);
      const availability = await computeStylistAvailability({
        sudo,
        stylistId: request.stylistId,
        date: zonedDateKey(request.start, location.timezone),
        serviceDuration: duration,
        serviceIds: request.serviceIds,
        locationId: location.locationId
      });
      const blockedReason = authoritativeBookingCapacityReason(availability.slots, request.start);
      if (blockedReason) return blockedReason;
      const exactSlot = availability.slots.find((slot) => new Date(slot.startTime).getTime() === request.start.getTime());
      if (!exactSlot?.available) return null;
    } catch {
      return null;
    }
  }
  return null;
}
var bookAppointment = import_core62.graphql.field({
  type: BookAppointmentResult,
  args: {
    serviceIds: import_core62.graphql.arg({ type: import_core62.graphql.nonNull(import_core62.graphql.list(import_core62.graphql.nonNull(import_core62.graphql.ID))) }),
    stylistId: import_core62.graphql.arg({ type: import_core62.graphql.nonNull(import_core62.graphql.ID) }),
    locationId: import_core62.graphql.arg({ type: import_core62.graphql.ID }),
    startTime: import_core62.graphql.arg({ type: import_core62.graphql.nonNull(import_core62.graphql.String) }),
    clientName: import_core62.graphql.arg({ type: import_core62.graphql.nonNull(import_core62.graphql.String) }),
    clientEmail: import_core62.graphql.arg({ type: import_core62.graphql.nonNull(import_core62.graphql.String) }),
    clientPhone: import_core62.graphql.arg({ type: import_core62.graphql.String }),
    clientNotes: import_core62.graphql.arg({ type: import_core62.graphql.String }),
    policyAccepted: import_core62.graphql.arg({ type: import_core62.graphql.Boolean }),
    policyVersion: import_core62.graphql.arg({ type: import_core62.graphql.String }),
    requestKey: import_core62.graphql.arg({ type: import_core62.graphql.String })
  },
  async resolve(source, args, context) {
    const serviceIds = Array.from(new Set(args.serviceIds.filter(Boolean)));
    const clientName = args.clientName.trim();
    const clientEmail = args.clientEmail.trim().toLowerCase();
    const clientPhone = args.clientPhone?.trim() || "";
    const start = new Date(args.startTime);
    const isOperator2 = permissions.canManageAppointments({ session: context.session });
    const policy = bookingPolicy();
    if (!isOperator2 && !hasCurrentBookingPolicyAffirmation(args.policyAccepted, args.policyVersion, policy.version)) return { success: false, appointmentId: null, error: "Read and accept the current booking policy before reserving" };
    if (args.requestKey && (args.requestKey.length < 12 || args.requestKey.length > 160)) return { success: false, appointmentId: null, error: "Booking request key is invalid" };
    const requestHash = (0, import_node_crypto4.createHash)("sha256").update(JSON.stringify({ serviceIds: [...serviceIds].sort(), stylistId: args.stylistId, locationId: args.locationId || null, startTime: args.startTime, clientName, clientEmail, clientPhone, notes: args.clientNotes || "", policyVersion: args.policyVersion || null })).digest("hex");
    const requestKey = (0, import_node_crypto4.createHash)("sha256").update(`${context.session?.itemId || "guest"}:${args.requestKey || requestHash}`).digest("hex");
    if (serviceIds.length === 0) {
      return { success: false, appointmentId: null, error: "Choose at least one service" };
    }
    if (serviceIds.length > 10) {
      return { success: false, appointmentId: null, error: "Too many services were selected" };
    }
    if (!clientName || clientName.length > 120) {
      return { success: false, appointmentId: null, error: "Client name is required" };
    }
    if (!clientEmail || clientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return { success: false, appointmentId: null, error: "A valid email address is required" };
    }
    if (clientPhone.length > 40 || (args.clientNotes?.length || 0) > 2e3) {
      return { success: false, appointmentId: null, error: "Booking contact details are too long" };
    }
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() || start.getTime() > Date.now() + 366 * 24 * 60 * 6e4) {
      return { success: false, appointmentId: null, error: "Appointment start time is invalid" };
    }
    try {
      const booking = await serializable(context, async (transactionContext) => {
        if (isOperator2) await assertFreshBookingOperator(transactionContext);
        const sudo = transactionContext.sudo();
        await transactionContext.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "salon-booking-request", requestKey);
        const replay = await transactionContext.prisma.appointment.findFirst({ where: { metadata: { path: ["bookingRequestKey"], equals: requestKey } }, select: { id: true, metadata: true } });
        if (replay) {
          if (replay.metadata?.bookingRequestHash !== requestHash) throw new Error("Booking request key was reused with different details");
          return { appointmentId: replay.id, duration: 0, services: [], stylistName: "", timezone: "UTC", replayed: true };
        }
        const services = await loadServices(sudo, serviceIds);
        if (!isOperator2 && services.some((service) => service.requiresConsultation || service.requiresPatchTest)) throw new Error("This service requires salon-assisted consultation or patch-test clearance before booking");
        await lockBookingCapacity(transactionContext, args.stylistId, services);
        const duration = services.reduce((sum, service) => sum + Number(service.baseDuration || 0), 0) || 60;
        const end = new Date(start.getTime() + duration * 6e4);
        const location = await getRuntimeLocation(sudo, args.locationId);
        const availability = await computeStylistAvailability({
          sudo,
          stylistId: args.stylistId,
          date: zonedDateKey(start, location.timezone),
          serviceDuration: duration,
          serviceIds,
          locationId: location.locationId
        });
        const selectedSlot = availability.slots.find((slot) => new Date(slot.startTime).getTime() === start.getTime());
        if (!selectedSlot?.available) {
          throw new Error(selectedSlot?.blockedReason || "Selected time is outside the stylist's schedule");
        }
        const stylistName = availability.stylistName;
        if (services.some((service) => !service.specialists?.some((stylist) => stylist.id === args.stylistId))) {
          throw new Error("Selected practitioner is not qualified for every booked service");
        }
        const resourceId = selectedSlot.resourceId;
        const client = await resolveAuthorizedClient(
          sudo,
          { name: clientName, email: clientEmail, phone: clientPhone },
          isOperator2 ? void 0 : context.session?.itemId,
          isOperator2
        );
        const appointment = await sudo.query.Appointment.createOne({
          data: {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration,
            status: "pending",
            depositAmount: services.reduce((sum, service) => sum + Number(service.depositAmount || 0), 0),
            depositPaid: false,
            location: availability.locationId ? { connect: { id: availability.locationId } } : void 0,
            client: client ? { connect: { id: client.id } } : void 0,
            stylist: { connect: { id: args.stylistId } },
            resource: resourceId ? { connect: { id: resourceId } } : void 0,
            services: { connect: serviceIds.map((id) => ({ id })) },
            clientNotes: args.clientNotes?.trim() || "",
            metadata: {
              source: "storefront_booking",
              bookingRequestKey: requestKey,
              bookingRequestHash: requestHash,
              guest: client ? null : { name: clientName, email: clientEmail, phone: clientPhone },
              clientPolicySnapshot: {
                version: policy.version,
                effectiveFrom: (/* @__PURE__ */ new Date()).toISOString(),
                effectiveUntil: null,
                revokedAt: null,
                cancellationNoticeMinutes: policy.cancellationNoticeMinutes,
                rescheduleNoticeMinutes: policy.rescheduleNoticeMinutes,
                cancellationDeadline: new Date(start.getTime() - policy.cancellationNoticeMinutes * 6e4).toISOString(),
                rescheduleDeadline: new Date(start.getTime() - policy.rescheduleNoticeMinutes * 6e4).toISOString(),
                acceptedAt: args.policyAccepted === true && args.policyVersion === policy.version ? (/* @__PURE__ */ new Date()).toISOString() : null
              }
            }
          },
          query: "id"
        });
        const bookedLines = [];
        for (const service of services) {
          const snapshot2 = captureServiceSnapshot(service);
          const line = await sudo.query.AppointmentLineItem.createOne({
            data: {
              appointment: { connect: { id: appointment.id } },
              service: { connect: { id: service.id } },
              staff: { connect: { id: args.stylistId } },
              serviceTitle: snapshot2.serviceTitle,
              serviceImagePath: snapshot2.serviceImagePath,
              duration: snapshot2.duration,
              price: snapshot2.price,
              quantity: 1,
              notes: args.clientNotes?.trim() || "",
              metadata: {
                snapshotType: "booking_request",
                snapshotVersion: 1,
                serviceId: service.id,
                serviceName: snapshot2.serviceTitle,
                serviceImagePath: snapshot2.serviceImagePath,
                serviceBasePrice: service.basePrice,
                servicePrice: snapshot2.price,
                requestedStartTime: start.toISOString()
              }
            },
            query: "id"
          });
          bookedLines.push({ id: line.id, service, duration: snapshot2.duration });
        }
        const domain3 = sudo.query;
        const scheduleShape = bookedLines.map((line, index) => ({
          lineItemId: line.id,
          stableKey: `service-${index + 1}`,
          sequence: index,
          startOffsetMinutes: bookedLines.slice(0, index).reduce((sum, item) => sum + item.duration, 0),
          durationMinutes: line.duration,
          practitionerId: args.stylistId,
          resourceId: resourceId && line.service.requiredResources?.some((resource) => resource.id === resourceId) ? resourceId : null
        }));
        const scheduleKey = `booking:${appointment.id}:schedule:v1`;
        const scheduleHash = (0, import_node_crypto4.createHash)("sha256").update(JSON.stringify(scheduleShape)).digest("hex");
        const revision = await domain3.AppointmentScheduleRevision.createOne({ data: {
          appointment: { connect: { id: appointment.id } },
          revision: 1,
          nextStart: start.toISOString(),
          nextEnd: end.toISOString(),
          reason: "Initial booking allocation",
          actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : void 0,
          actorAuthority: context.session?.itemId ? "authenticated_client_or_operator" : "public_booking_boundary",
          scheduleHash,
          idempotencyKey: scheduleKey,
          evidence: { source: "bookAppointment", segmentCount: scheduleShape.length }
        }, query: "id" });
        for (const segment of scheduleShape) {
          const segmentStart = new Date(start.getTime() + segment.startOffsetMinutes * 6e4);
          await domain3.AppointmentSegment.createOne({ data: {
            appointment: { connect: { id: appointment.id } },
            lineItem: { connect: { id: segment.lineItemId } },
            revision: { connect: { id: revision.id } },
            stableKey: segment.stableKey,
            sequence: segment.sequence,
            parallelGroup: "",
            type: "service",
            plannedStart: segmentStart.toISOString(),
            plannedEnd: new Date(segmentStart.getTime() + segment.durationMinutes * 6e4).toISOString(),
            durationMinutes: segment.durationMinutes,
            practitionerRequired: true,
            practitioner: { connect: { id: args.stylistId } },
            resource: segment.resourceId ? { connect: { id: segment.resourceId } } : void 0,
            resourceUnits: segment.resourceId ? 1 : 0,
            status: "planned",
            idempotencyKey: `${scheduleKey}:${segment.stableKey}`,
            assignmentEvidence: { source: "booking_snapshot", qualifiedByServiceSpecialist: true, scheduleHash }
          }, query: "id" });
        }
        return { appointmentId: appointment.id, duration, services, stylistName, timezone: location.timezone, replayed: false };
      });
      if (booking.replayed) return { success: true, appointmentId: booking.appointmentId, error: null };
      try {
        const dateStr = start.toLocaleDateString("en-US", {
          timeZone: booking.timezone,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });
        const timeStr = start.toLocaleTimeString("en-US", {
          timeZone: booking.timezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        });
        const totalPrice = booking.services.reduce((sum, service) => sum + servicePriceCents(service), 0);
        const messageBrand = await getStorefrontMessageBrand(context);
        await sendAppointmentConfirmation({
          to: clientEmail,
          clientName,
          serviceName: booking.services.map((service) => service.name).join(", "),
          stylistName: booking.stylistName,
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          duration: booking.duration,
          price: totalPrice / 100,
          storefrontName: messageBrand.name,
          themeHue: messageBrand.themeHue
        });
      } catch (emailError) {
        console.error("Failed to send appointment confirmation email:", emailError);
      }
      return { success: true, appointmentId: booking.appointmentId, error: null };
    } catch (error) {
      if (error instanceof BookingOperatorDenied) return { success: false, appointmentId: null, error: error.message };
      if (isOperator2) {
        const verification = await assertFreshBookingOperator(context).then(
          () => ({ verified: true }),
          (failure) => ({ verified: false, failure })
        );
        if (!verification.verified) {
          return { success: false, appointmentId: null, error: verification.failure instanceof BookingOperatorDenied ? verification.failure.message : BOOKING_OUTCOME_UNRESOLVED };
        }
      }
      const recovered = await recoverBookingByIdempotency(context, requestKey, requestHash);
      if (recovered.status === "accepted") return { success: true, appointmentId: recovered.appointmentId, error: null };
      if (recovered.status === "conflict") return { success: false, appointmentId: null, error: BOOKING_REQUEST_KEY_CONFLICT };
      if (recovered.status === "unresolved") return { success: false, appointmentId: null, error: BOOKING_OUTCOME_UNRESOLVED };
      const capacityReason = opaqueAppointmentLifecycleError(error) ? await recheckFailedBookingCapacity(context, { serviceIds, stylistId: args.stylistId, locationId: args.locationId, start }) : null;
      return {
        success: false,
        appointmentId: null,
        error: classifiedBookingError(error, capacityReason)
      };
    }
  }
});

// features/keystone/extendGraphqlSchema/checkAvailability.ts
var import_core63 = require("@keystone-6/core");
var TimeSlot = import_core63.graphql.object()({
  name: "TimeSlot",
  fields: {
    time: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    startTime: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    available: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.Boolean) }),
    resourceId: import_core63.graphql.field({ type: import_core63.graphql.String }),
    resourceName: import_core63.graphql.field({ type: import_core63.graphql.String }),
    blockedReason: import_core63.graphql.field({ type: import_core63.graphql.String })
  }
});
var AvailabilityResult = import_core63.graphql.object()({
  name: "AvailabilityResult",
  fields: {
    stylistId: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.ID) }),
    stylistName: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    date: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    timezone: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    locationId: import_core63.graphql.field({ type: import_core63.graphql.ID }),
    slots: import_core63.graphql.field({ type: import_core63.graphql.nonNull(import_core63.graphql.list(import_core63.graphql.nonNull(TimeSlot))) })
  }
});
var checkAvailability = import_core63.graphql.field({
  type: AvailabilityResult,
  args: {
    stylistId: import_core63.graphql.arg({ type: import_core63.graphql.nonNull(import_core63.graphql.ID) }),
    date: import_core63.graphql.arg({ type: import_core63.graphql.nonNull(import_core63.graphql.String) }),
    serviceDuration: import_core63.graphql.arg({ type: import_core63.graphql.nonNull(import_core63.graphql.Int) }),
    serviceId: import_core63.graphql.arg({ type: import_core63.graphql.ID }),
    locationId: import_core63.graphql.arg({ type: import_core63.graphql.ID })
  },
  async resolve(_source, args, context) {
    const sudo = context.sudo();
    let duration = args.serviceDuration;
    if (args.serviceId) {
      const service = await sudo.query.Service.findOne({
        where: { id: args.serviceId },
        query: "id status baseDuration"
      });
      if (!service || !isActiveServiceStatus(service.status)) throw new Error("Service is unavailable");
      duration = Number(service.baseDuration || duration);
    }
    return computeStylistAvailability({
      sudo,
      stylistId: args.stylistId,
      date: args.date,
      serviceDuration: duration,
      serviceIds: args.serviceId ? [args.serviceId] : [],
      locationId: args.locationId
    });
  }
});
var availabilityExtension = import_core63.graphql.extend(() => ({
  query: { checkAvailability }
}));

// features/keystone/extendGraphqlSchema/calculateCommission.ts
var import_core64 = require("@keystone-6/core");
var ServiceCommission = import_core64.graphql.object()({
  name: "ServiceCommission",
  fields: {
    serviceName: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    revenue: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) }),
    commission: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) })
  }
});
var AppointmentCommission = import_core64.graphql.object()({
  name: "AppointmentCommission",
  fields: {
    appointmentId: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.ID) }),
    date: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    clientName: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    services: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.list(import_core64.graphql.nonNull(ServiceCommission))) }),
    totalRevenue: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) }),
    totalCommission: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) })
  }
});
var CommissionResult = import_core64.graphql.object()({
  name: "CommissionResult",
  fields: {
    stylistId: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.ID) }),
    stylistName: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    startDate: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    endDate: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    commissionRate: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) }),
    appointments: import_core64.graphql.field({
      type: import_core64.graphql.nonNull(import_core64.graphql.list(import_core64.graphql.nonNull(AppointmentCommission)))
    }),
    totalServiceRevenue: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) }),
    totalServiceCommission: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Float) }),
    appointmentCount: import_core64.graphql.field({ type: import_core64.graphql.nonNull(import_core64.graphql.Int) })
  }
});
var calculateCommission = import_core64.graphql.field({
  type: CommissionResult,
  args: {
    stylistId: import_core64.graphql.arg({ type: import_core64.graphql.nonNull(import_core64.graphql.ID) }),
    startDate: import_core64.graphql.arg({ type: import_core64.graphql.nonNull(import_core64.graphql.String) }),
    endDate: import_core64.graphql.arg({ type: import_core64.graphql.nonNull(import_core64.graphql.String) })
  },
  async resolve(source, args, context) {
    if (!permissions.canManageCommissions({ session: context.session })) {
      throw new Error("Not authorized to calculate commissions");
    }
    const { stylistId, startDate, endDate } = args;
    const sudo = context.sudo();
    const stylist = await sudo.query.Stylist.findOne({
      where: { id: stylistId },
      query: "id user { name } commissionRate tier"
    });
    if (!stylist) {
      throw new Error("Stylist not found");
    }
    const stylistName = stylist.user?.name || "Unknown Stylist";
    let commissionRate = stylist.commissionRate;
    if (!commissionRate) {
      switch (stylist.tier) {
        case "master":
          commissionRate = 0.5;
          break;
        case "senior":
          commissionRate = 0.45;
          break;
        case "junior":
          commissionRate = 0.35;
          break;
        default:
          commissionRate = 0.4;
      }
    }
    const start = /* @__PURE__ */ new Date(`${startDate}T00:00:00`);
    const end = /* @__PURE__ */ new Date(`${endDate}T23:59:59.999`);
    const appointments = await sudo.query.Appointment.findMany({
      where: {
        stylist: { id: { equals: stylistId } },
        startTime: {
          gte: start.toISOString(),
          lte: end.toISOString()
        },
        status: { equals: "completed" }
      },
      query: `
        id
        startTime
        client { user { name } }
        services {
          id
          name
          price
          basePrice
        }
      `
    });
    let totalServiceRevenue = 0;
    let totalServiceCommission = 0;
    const appointmentCommissions = appointments.map((appointment) => {
      const services = appointment.services || [];
      let appointmentRevenue = 0;
      let appointmentCommission = 0;
      const serviceDetails = services.map((service) => {
        const serviceRevenue = service.price || service.basePrice || 0;
        const serviceCommission = Math.round(serviceRevenue * commissionRate);
        appointmentRevenue += serviceRevenue;
        appointmentCommission += serviceCommission;
        return {
          serviceName: service.name,
          revenue: serviceRevenue,
          commission: serviceCommission
        };
      });
      totalServiceRevenue += appointmentRevenue;
      totalServiceCommission += appointmentCommission;
      return {
        appointmentId: appointment.id,
        date: new Date(appointment.startTime).toISOString().split("T")[0],
        clientName: appointment.client?.user?.name || "Walk-in",
        services: serviceDetails,
        totalRevenue: appointmentRevenue,
        totalCommission: appointmentCommission
      };
    });
    return {
      stylistId,
      stylistName,
      startDate,
      endDate,
      commissionRate,
      appointments: appointmentCommissions,
      totalServiceRevenue,
      totalServiceCommission,
      appointmentCount: appointments.length
    };
  }
});
var commissionExtension = import_core64.graphql.extend((base) => ({
  query: {
    calculateCommission
  }
}));

// features/keystone/extendGraphqlSchema/storefrontStylists.ts
var import_core65 = require("@keystone-6/core");

// features/keystone/extendGraphqlSchema/publicImageProjection.ts
function projectPublicSalonImage(image2) {
  if (!image2 || image2.visibility !== "public") return null;
  return {
    image: typeof image2.image?.url === "string" && image2.image.url ? { url: image2.image.url } : null,
    imagePath: typeof image2.imagePath === "string" ? image2.imagePath : null,
    altText: typeof image2.altText === "string" ? image2.altText : null
  };
}

// features/keystone/extendGraphqlSchema/storefrontStylistFilters.ts
function storefrontStylistWhere(serviceId) {
  const where = { isActive: { equals: true } };
  if (serviceId !== void 0 && serviceId !== null) {
    where.status = { equals: "active" };
    where.specializations = { some: { id: { equals: serviceId } } };
  }
  return where;
}

// features/keystone/extendGraphqlSchema/storefrontStylists.ts
var StorefrontStylistUser = import_core65.graphql.object()({
  name: "StorefrontStylistUser",
  fields: {
    id: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.ID) }),
    name: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.String) })
  }
});
var StorefrontStylistImage = import_core65.graphql.object()({
  name: "StorefrontStylistImage",
  fields: {
    url: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.String) })
  }
});
var StorefrontStylistPhoto = import_core65.graphql.object()({
  name: "StorefrontStylistPhoto",
  fields: {
    image: import_core65.graphql.field({ type: StorefrontStylistImage }),
    imagePath: import_core65.graphql.field({ type: import_core65.graphql.String }),
    altText: import_core65.graphql.field({ type: import_core65.graphql.String })
  }
});
var StorefrontSpecialization = import_core65.graphql.object()({
  name: "StorefrontSpecialization",
  fields: {
    id: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.ID) }),
    name: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.String) })
  }
});
var StorefrontSchedule = import_core65.graphql.object()({
  name: "StorefrontSchedule",
  fields: {
    id: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.ID) }),
    dayOfWeek: import_core65.graphql.field({ type: import_core65.graphql.Int }),
    startTime: import_core65.graphql.field({ type: import_core65.graphql.String }),
    endTime: import_core65.graphql.field({ type: import_core65.graphql.String }),
    isAvailable: import_core65.graphql.field({ type: import_core65.graphql.Boolean })
  }
});
var StorefrontStylist = import_core65.graphql.object()({
  name: "StorefrontStylist",
  fields: {
    id: import_core65.graphql.field({ type: import_core65.graphql.nonNull(import_core65.graphql.ID) }),
    user: import_core65.graphql.field({ type: StorefrontStylistUser }),
    tier: import_core65.graphql.field({ type: import_core65.graphql.String }),
    bio: import_core65.graphql.field({ type: import_core65.graphql.String }),
    isActive: import_core65.graphql.field({ type: import_core65.graphql.Boolean }),
    photo: import_core65.graphql.field({ type: StorefrontStylistPhoto }),
    specializations: import_core65.graphql.field({
      type: import_core65.graphql.nonNull(import_core65.graphql.list(import_core65.graphql.nonNull(StorefrontSpecialization)))
    }),
    schedules: import_core65.graphql.field({
      type: import_core65.graphql.nonNull(import_core65.graphql.list(import_core65.graphql.nonNull(StorefrontSchedule)))
    })
  }
});
var STYLIST_SELECTION = `
  id
  user { id name }
  tier
  bio
  isActive
  photo { visibility image { url } imagePath altText }
  specializations { id name }
  schedules { id dayOfWeek startTime endTime isAvailable }
`;
function projectStorefrontStylist(stylist) {
  return { ...stylist, photo: projectPublicSalonImage(stylist.photo) };
}
var storefrontStylists = import_core65.graphql.field({
  type: import_core65.graphql.nonNull(import_core65.graphql.list(import_core65.graphql.nonNull(StorefrontStylist))),
  args: {
    serviceId: import_core65.graphql.arg({ type: import_core65.graphql.ID }),
    take: import_core65.graphql.arg({ type: import_core65.graphql.Int })
  },
  async resolve(source, args, context) {
    const sudo = context.sudo();
    const take = args.take && args.take > 0 ? Math.min(args.take, 100) : 100;
    const where = storefrontStylistWhere(args.serviceId);
    const stylists = await sudo.query.Stylist.findMany({
      where,
      take,
      orderBy: { tier: "desc" },
      query: STYLIST_SELECTION
    });
    return stylists.map(projectStorefrontStylist);
  }
});
var storefrontStylist = import_core65.graphql.field({
  type: StorefrontStylist,
  args: {
    id: import_core65.graphql.arg({ type: import_core65.graphql.nonNull(import_core65.graphql.ID) })
  },
  async resolve(source, args, context) {
    const sudo = context.sudo();
    const stylist = await sudo.query.Stylist.findOne({
      where: { id: args.id },
      query: STYLIST_SELECTION
    });
    return stylist ? projectStorefrontStylist(stylist) : null;
  }
});

// features/keystone/extendGraphqlSchema/salonOperationsWorkspace.ts
var import_core66 = require("@keystone-6/core");
var sections = ["clients", "catalog", "benefits", "inventory", "engagement", "administration", "reports", "integrations"];
var definitions = {
  clients: { title: "Client care", description: "Client counts are all-record counts; recorded lifetime value and attention use at most 50 most-recently-updated clients, so those sample figures may be incomplete." },
  catalog: { title: "Services & catalog", description: "Check bookability, duration, pricing, resource coverage, and active catalog status." },
  benefits: { title: "Memberships, packages & gift cards", description: "Monitor active benefit programs and outstanding client value from server-owned balances." },
  inventory: { title: "Retail inventory", description: "Product and reorder-attention metrics use up to 50 lowest aggregate-quantity products; they are sample-only and do not represent the full catalog, per-location stock, or location sellability." },
  engagement: { title: "Waitlist & communications", description: "Work the active waitlist and watch delivery outcomes from one operational queue." },
  administration: { title: "Staff & locations", description: "Review active locations, provider assignment, schedule coverage, and resource readiness." },
  reports: { title: "Salon reports", description: "Review up to 500 most-recently-processed payments and 500 unpaid commission rows. Net payment collections include recorded tax and tips; these bounded figures are not earned service revenue or full-period accounting." },
  integrations: { title: "Integrations & exceptions", description: "See provider readiness, webhook processing, and domain-event delivery exceptions without exposing provider configuration or payloads." }
};
var metricType = import_core66.graphql.object()({ name: "SalonWorkspaceMetric", fields: {
  label: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }),
  value: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.Int) }),
  format: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) })
} });
var recordType = import_core66.graphql.object()({ name: "SalonWorkspaceRecord", fields: {
  id: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.ID) }),
  title: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }),
  subtitle: import_core66.graphql.field({ type: import_core66.graphql.String }),
  status: import_core66.graphql.field({ type: import_core66.graphql.String }),
  detail: import_core66.graphql.field({ type: import_core66.graphql.String }),
  amount: import_core66.graphql.field({ type: import_core66.graphql.Int }),
  metric: import_core66.graphql.field({ type: import_core66.graphql.Int }),
  occurredAt: import_core66.graphql.field({ type: import_core66.graphql.String }),
  href: import_core66.graphql.field({ type: import_core66.graphql.String }),
  action: import_core66.graphql.field({ type: import_core66.graphql.String })
} });
var resultType = import_core66.graphql.object()({ name: "SalonOperationsWorkspace", fields: {
  actorId: import_core66.graphql.field({ type: import_core66.graphql.ID }),
  section: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }),
  title: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }),
  description: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }),
  attentionCount: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.Int) }),
  metrics: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.list(import_core66.graphql.nonNull(metricType))) }),
  records: import_core66.graphql.field({ type: import_core66.graphql.nonNull(import_core66.graphql.list(import_core66.graphql.nonNull(recordType))) })
} });
var money = (label, value) => ({ label, value: Math.round(value), format: "money" });
var count = (label, value) => ({ label, value, format: "count" });
var text53 = (value, fallback = "\u2014") => typeof value === "string" && value.trim() ? value.trim() : fallback;
var date = (value) => value ? new Date(value).toISOString() : null;
async function clients(sudo) {
  const [rows, total, repeat] = await Promise.all([
    sudo.query.Client.findMany({ take: 50, orderBy: { updatedAt: "desc" }, query: "id totalVisits lifetimeValue marketingConsent user { name email } preferredStylist { user { name } } updatedAt" }),
    sudo.query.Client.count({}),
    sudo.query.Client.count({ where: { totalVisits: { gt: 1 } } })
  ]);
  const records = rows.map((row) => ({ id: row.id, title: text53(row.user?.name, "Unnamed client"), subtitle: row.user?.email || null, status: row.marketingConsent ? "Marketing opted in" : "Service only", detail: row.preferredStylist?.user?.name ? `Prefers ${row.preferredStylist.user.name}` : "No preferred provider", amount: Number(row.lifetimeValue || 0), metric: Number(row.totalVisits || 0), occurredAt: date(row.updatedAt), href: null, action: null }));
  return { metrics: [count("Clients", total), count("Repeat clients", repeat), money("Recorded lifetime value (sample)", records.reduce((sum, row) => sum + (row.amount || 0), 0))], records, attentionCount: records.filter((row) => !row.metric).length };
}
async function catalog(sudo) {
  const [rows, active, categories] = await Promise.all([
    sudo.query.Service.findMany({ take: 50, orderBy: { name: "asc" }, query: "id name status baseDuration price basePrice depositRequired category { name } requiredResources { id }" }),
    sudo.query.Service.count({ where: { status: { equals: "active" } } }),
    sudo.query.ServiceCategory.count({})
  ]);
  const records = rows.map((row) => {
    const covered = (row.requiredResources || []).length;
    return { id: row.id, title: row.name, subtitle: row.category?.name || "Uncategorized", status: row.status || "draft", detail: `${row.baseDuration || 0} min \xB7 ${covered ? `${covered} resource option${covered === 1 ? "" : "s"}` : "No resource coverage"}`, amount: Number(row.price ?? row.basePrice ?? 0), metric: covered, occurredAt: null, href: null, action: null };
  });
  return { metrics: [count("Active services", active), count("Categories", categories), count("Catalog items", rows.length)], records, attentionCount: records.filter((row) => row.status !== "active" || row.metric === 0).length };
}
async function benefits(sudo) {
  const [memberships, packages, cards, activeCards] = await Promise.all([
    sudo.query.Membership.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name monthlyPrice discountPercent isActive includedServicesCount" }),
    sudo.query.ServicePackage.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name totalPrice savingsAmount validDays isActive servicesCount" }),
    sudo.query.GiftCard.findMany({ take: 20, orderBy: { createdAt: "desc" }, query: "id recipientName currentBalance isActive expiresAt createdAt" }),
    sudo.query.GiftCard.count({ where: { isActive: { equals: true } } })
  ]);
  const records = [
    ...memberships.map((row) => ({ id: `membership:${row.id}`, title: row.name, subtitle: `${row.discountPercent || 0}% member discount`, status: row.isActive ? "Active membership" : "Inactive", detail: `${row.includedServicesCount || 0} included services`, amount: row.monthlyPrice || 0, metric: row.includedServicesCount || 0, occurredAt: null, href: null, action: null })),
    ...packages.map((row) => ({ id: `package:${row.id}`, title: row.name, subtitle: `${row.validDays || 0} day validity`, status: row.isActive ? "Active package" : "Inactive", detail: `${row.servicesCount || 0} services \xB7 ${(row.savingsAmount || 0) > 0 ? "client savings configured" : "no savings"}`, amount: row.totalPrice || 0, metric: row.servicesCount || 0, occurredAt: null, href: null, action: null })),
    ...cards.map((row) => ({ id: `gift:${row.id}`, title: text53(row.recipientName, "Gift card"), subtitle: "Gift card balance", status: row.isActive ? "Redeemable" : "Inactive", detail: row.expiresAt ? `Expires ${new Date(row.expiresAt).toLocaleDateString("en-US")}` : "No expiry", amount: row.currentBalance || 0, metric: null, occurredAt: date(row.createdAt), href: null, action: null }))
  ];
  return { metrics: [count("Membership plans", memberships.filter((x) => x.isActive).length), count("Packages", packages.filter((x) => x.isActive).length), count("Active gift cards", activeCards)], records, attentionCount: records.filter((row) => row.status === "Inactive").length };
}
async function inventory(context) {
  const [products, movements, locations] = await Promise.all([
    context.query.Product.findMany({ take: 50, orderBy: { quantity: "asc" }, query: "id name sku quantity reorderPoint price isActive updatedAt" }),
    context.query.InventoryMovement.findMany({ take: 20, orderBy: { createdAt: "desc" }, query: "id type delta balanceAfter reason createdAt product { id name } location { name }" }),
    context.query.Location.findMany({ take: 20, where: stockLocationWhere(context), orderBy: { name: "asc" }, query: "id name city state" })
  ]);
  const low = products.filter((row) => row.isActive && Number(row.quantity || 0) <= Number(row.reorderPoint || 0));
  const records = [
    ...locations.map((row) => ({ id: `location:${row.id}`, title: row.name, subtitle: [row.city, row.state].filter(Boolean).join(", ") || "Inventory location", status: "Stock location", detail: "Available for controlled inventory adjustments", amount: null, metric: null, occurredAt: null, href: null, action: null })),
    ...products.map((row) => ({ id: `product:${row.id}`, title: row.name, subtitle: row.sku || "No SKU", status: !row.isActive ? "Inactive" : Number(row.quantity || 0) <= Number(row.reorderPoint || 0) ? "Aggregate reorder" : "Aggregate stock", detail: `${row.quantity || 0} aggregate units across locations \xB7 aggregate reorder point ${row.reorderPoint || 0}`, amount: row.price || 0, metric: row.quantity || 0, occurredAt: date(row.updatedAt), href: null, action: row.isActive ? "adjust_inventory" : null })),
    ...movements.slice(0, 10).map((row) => ({ id: `movement:${row.id}`, title: row.product?.name || "Inventory movement", subtitle: row.location?.name || "Unscoped location", status: row.type, detail: `${row.delta > 0 ? "+" : ""}${row.delta} \xB7 balance ${row.balanceAfter} \xB7 ${row.reason}`, amount: null, metric: row.balanceAfter, occurredAt: date(row.createdAt), href: null, action: null }))
  ];
  return { metrics: [count("Active products (sample)", products.filter((x) => x.isActive).length), count("Aggregate reorder (sample)", low.length), count("Aggregate units on hand (sample)", products.reduce((sum, x) => sum + Number(x.quantity || 0), 0))], records, attentionCount: low.length };
}
async function engagement(sudo) {
  const [waitlist, messageLogs, active, failed, sent] = await Promise.all([
    sudo.query.WaitlistEntry.findMany({ take: 50, orderBy: { createdAt: "asc" }, query: "id guestName status preferredTimeRange dateRangeStart dateRangeEnd createdAt client { name } service { name } preferredStylists { user { name } }" }),
    sudo.query.MessageLog.findMany({ take: 20, orderBy: { sentAt: "desc" }, query: "id channel status sentAt recipient { name } template { name }" }),
    sudo.query.WaitlistEntry.count({ where: { status: { in: ["active", "notified"] } } }),
    sudo.query.MessageLog.count({ where: { status: { equals: "failed" } } }),
    sudo.query.MessageLog.count({ where: { status: { in: ["sent", "delivered"] } } })
  ]);
  const records = [
    ...waitlist.map((row) => ({ id: row.id, title: row.client?.name || row.guestName || "Waitlist guest", subtitle: row.service?.name || "Any service", status: row.status || "active", detail: [row.preferredTimeRange, row.preferredStylists?.[0]?.user?.name].filter(Boolean).join(" \xB7 ") || "Flexible provider and time", amount: null, metric: null, occurredAt: date(row.createdAt), href: null, action: row.status === "active" ? "notify_waitlist" : row.status === "notified" ? "remove_waitlist" : null })),
    ...messageLogs.map((row) => ({ id: `message:${row.id}`, title: row.template?.name || `${row.channel || "Message"} communication`, subtitle: row.recipient?.name || "Recipient omitted", status: row.status, detail: row.status === "failed" ? "Delivery needs operator review" : `Sent by ${row.channel || "configured channel"}`, amount: null, metric: null, occurredAt: date(row.sentAt), href: null, action: null }))
  ];
  return { metrics: [count("Open waitlist", active), count("Messages delivered/sent", sent), count("Delivery failures", failed)], records, attentionCount: active + failed };
}
async function administration(sudo) {
  const [locations, stylists, resources] = await Promise.all([
    sudo.query.Location.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name city state timezone isActive stylistsCount resourcesCount" }),
    sudo.query.Stylist.findMany({ take: 50, orderBy: { createdAt: "asc" }, query: "id role status isActive user { name } locations { id name } schedulesCount" }),
    sudo.query.SalonResource.count({ where: { isActive: { equals: true } } })
  ]);
  const records = [
    ...locations.map((row) => ({ id: `location:${row.id}`, title: row.name, subtitle: [row.city, row.state].filter(Boolean).join(", ") || row.timezone, status: row.isActive ? "Active location" : "Inactive", detail: `${row.stylistsCount || 0} staff \xB7 ${row.resourcesCount || 0} resources`, amount: null, metric: row.stylistsCount || 0, occurredAt: null, href: null, action: null })),
    ...stylists.map((row) => ({ id: `stylist:${row.id}`, title: row.user?.name || "Unnamed provider", subtitle: row.locations?.map((x) => x.name).join(", ") || "No location assignment", status: row.isActive && row.status !== "inactive" ? "Active staff" : "Inactive", detail: `${row.role || "stylist"} \xB7 ${row.schedulesCount || 0} schedule blocks`, amount: null, metric: row.schedulesCount || 0, occurredAt: null, href: null, action: null }))
  ];
  return { metrics: [count("Active locations", locations.filter((x) => x.isActive).length), count("Active staff", stylists.filter((x) => x.isActive && x.status !== "inactive").length), count("Active resources", resources)], records, attentionCount: records.filter((row) => row.status === "Inactive" || row.subtitle === "No location assignment" || row.metric === 0).length };
}
async function reports(sudo) {
  const [payments, completed, cancelled, unpaidCommissions] = await Promise.all([
    sudo.query.Payment.findMany({ take: 500, where: { status: { in: ["completed", "partially_refunded", "refunded"] } }, orderBy: { processedAt: "desc" }, query: "id totalAmount tip refundedAmount status paymentMethod processedAt appointment { id location { name } }" }),
    sudo.query.Appointment.count({ where: { status: { equals: "completed" } } }),
    sudo.query.Appointment.count({ where: { status: { in: ["cancelled", "no_show"] } } }),
    sudo.query.Commission.findMany({ take: 500, where: { isPaid: { equals: false } }, query: "id commissionAmount" })
  ]);
  const gross = payments.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
  const refunds = payments.reduce((sum, row) => sum + Number(row.refundedAmount || 0), 0);
  const records = payments.slice(0, 50).map((row) => ({ id: row.id, title: `${row.paymentMethod || "Payment"} settlement`, subtitle: row.appointment?.location?.name || "Location not recorded", status: row.status, detail: `${row.tip || 0} cents tip \xB7 ${row.refundedAmount || 0} cents refunded`, amount: Number(row.totalAmount || 0) - Number(row.refundedAmount || 0), metric: null, occurredAt: date(row.processedAt), href: null, action: null }));
  return { metrics: [money("Net recorded payments in sample (incl. tax/tip)", gross - refunds), money("Refunds in same payment sample", refunds), money("Stored unpaid commissions in sample", unpaidCommissions.reduce((sum, x) => sum + Number(x.commissionAmount || 0), 0)), count("Completed appointments (all time)", completed), count("Cancelled / no-show (all time)", cancelled)], records, attentionCount: unpaidCommissions.length };
}
async function integrations(sudo) {
  const [providers, pending, failed, events, webhooks] = await Promise.all([
    sudo.query.PaymentProvider.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name code adapter isInstalled isDefault" }),
    sudo.query.DomainEvent.count({ where: { status: { equals: "pending" } } }),
    sudo.query.DomainEvent.count({ where: { status: { equals: "dead_letter" } } }),
    sudo.query.DomainEvent.findMany({ take: 30, where: { status: { in: ["pending", "dead_letter"] } }, orderBy: { occurredAt: "desc" }, query: "id eventType aggregateType aggregateId status attempts occurredAt" }),
    sudo.query.PaymentWebhookEvent.findMany({ take: 30, orderBy: { processedAt: "desc" }, query: "id eventId type status processedAt provider { name }" })
  ]);
  const records = [
    ...providers.map((row) => ({ id: `provider:${row.id}`, title: row.name, subtitle: `${row.adapter} \xB7 ${row.code}`, status: row.isInstalled ? row.isDefault ? "Installed \xB7 default" : "Installed" : "Not installed", detail: "Secrets and provider configuration are intentionally omitted", amount: null, metric: null, occurredAt: null, href: null, action: null })),
    ...events.map((row) => ({ id: `event:${row.id}`, title: row.eventType, subtitle: `${row.aggregateType} \xB7 ${row.aggregateId}`, status: row.status, detail: `${row.attempts || 0} delivery attempts`, amount: null, metric: row.attempts || 0, occurredAt: date(row.occurredAt), href: null, action: null })),
    ...webhooks.map((row) => ({ id: `webhook:${row.id}`, title: row.type, subtitle: row.provider?.name || "Unknown provider", status: row.status, detail: `Provider event ${row.eventId}`, amount: null, metric: null, occurredAt: date(row.processedAt), href: null, action: null }))
  ];
  return { metrics: [count("Installed providers", providers.filter((x) => x.isInstalled).length), count("Pending domain events", pending), count("Failed domain events", failed), count("Recent webhooks", webhooks.length)], records, attentionCount: providers.filter((x) => !x.isInstalled).length + pending + failed };
}
var loaders = { clients, catalog, benefits, inventory, engagement, administration, reports, integrations };
var sectionPermissions = {
  clients: permissions.canManageClients,
  catalog: permissions.canManageCatalog,
  benefits: ({ session }) => permissions.canManageCatalog({ session }) || permissions.canManageClients({ session }),
  inventory: permissions.canManageInventory,
  engagement: ({ session }) => permissions.canManageAppointments({ session }) || permissions.canManageClients({ session }),
  administration: permissions.canManageSalon,
  reports: permissions.canViewReports,
  integrations: permissions.canManageIntegrations
};
var salonOperationsWorkspace = import_core66.graphql.field({
  type: resultType,
  args: { section: import_core66.graphql.arg({ type: import_core66.graphql.nonNull(import_core66.graphql.String) }) },
  async resolve(_source, { section }, context) {
    if (!sections.includes(section)) throw new Error("Unsupported salon operations workspace");
    const key = section;
    if (!sectionPermissions[key]({ session: context.session })) throw new Error("You do not have permission for this salon workspace");
    if (key === "inventory") {
      const current = await currentStockContext(context, "adjust");
      const data2 = await inventory(current);
      await currentStockContext(context, "adjust");
      return { actorId: current.session.itemId, section: key, ...definitions[key], ...data2 };
    }
    const data = await loaders[key](context.sudo());
    return { section: key, ...definitions[key], ...data };
  }
});

// features/keystone/mutations/runSalonOnboarding.ts
var import_core68 = require("@keystone-6/core");

// features/platform/onboarding/lib/seed.json
var seed_default = {
  salonInfo: {
    key: "morrow-and-mane",
    name: "Morrow & Mane",
    description: "Hair, color, skin, and considered appointment booking.",
    themeHue: 28,
    address: "123 Beauty Street",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    phone: "+1 555 012 3456",
    email: "hello@morrowandmane.example",
    timezone: "America/Los_Angeles",
    hours: {
      monday: { open: "09:00", close: "20:00", closed: false },
      tuesday: { open: "09:00", close: "20:00", closed: false },
      wednesday: { open: "09:00", close: "20:00", closed: false },
      thursday: { open: "09:00", close: "21:00", closed: false },
      friday: { open: "09:00", close: "21:00", closed: false },
      saturday: { open: "08:00", close: "18:00", closed: false },
      sunday: { open: "10:00", close: "17:00", closed: false }
    }
  },
  resources: [
    {
      key: "cutting-station-1",
      name: "Cutting Station 1",
      type: "station",
      capacity: 1,
      isActive: true,
      notes: "Primary styling chair for cuts and blowouts."
    },
    {
      key: "color-bar-1",
      name: "Color Bar 1",
      type: "color_bar",
      capacity: 2,
      isActive: true,
      notes: "Color processing station with ventilation and shared shampoo access."
    },
    {
      key: "treatment-room-a",
      name: "Treatment Room A",
      type: "room",
      capacity: 1,
      isActive: true,
      notes: "Private room for facials, massage, and bridal makeup trials."
    }
  ],
  categories: [
    {
      key: "hair-services",
      name: "Hair Services",
      slug: "hair-services",
      description: "Cutting, color, gloss, and finishing services.",
      displayOrder: 10,
      icon: "scissors"
    },
    {
      key: "skin-spa",
      name: "Skin & Spa",
      slug: "skin-spa",
      description: "Consultation-led facial and treatment-room services.",
      displayOrder: 20,
      icon: "sparkles"
    }
  ],
  services: [
    {
      key: "signature-cut-blowout",
      name: "Signature Cut & Blowout",
      category: "Hair Services",
      description: "Consultation, shampoo, precision cut, and polished blowout.",
      imagePath: "/images/salon/haircut-detail.webp",
      baseDuration: 60,
      price: 8500,
      basePrice: 8500,
      depositRequired: false,
      depositAmount: 0,
      requiredResources: ["cutting-station-1"]
    },
    {
      key: "full-dimension-color",
      name: "Full Dimension Color",
      category: "Hair Services",
      description: "Full dimensional color service with gloss finish and blowout.",
      imagePath: "/images/salon/color-service.webp",
      baseDuration: 180,
      price: 24500,
      basePrice: 24500,
      depositRequired: true,
      depositAmount: 5e3,
      requiredResources: ["color-bar-1"]
    },
    {
      key: "gloss-toner-refresh",
      name: "Gloss + Toner Refresh",
      category: "Hair Services",
      description: "Toner or gloss refresh to revive color between full appointments.",
      imagePath: "/images/salon/interior.webp",
      baseDuration: 75,
      price: 9500,
      basePrice: 9500,
      depositRequired: false,
      depositAmount: 0,
      requiredResources: ["color-bar-1"]
    },
    {
      key: "custom-clinical-facial",
      name: "Custom Clinical Facial",
      category: "Skin & Spa",
      description: "Personalized facial based on skin profile and treatment goals.",
      imagePath: "/images/salon/facial-treatment.webp",
      baseDuration: 90,
      price: 13500,
      basePrice: 13500,
      depositRequired: false,
      depositAmount: 0,
      requiredResources: ["treatment-room-a"]
    }
  ],
  stylists: [
    {
      key: "maya-chen",
      name: "Maya Chen",
      email: "maya.chen@morrowandmane.example",
      phone: "+1 843 555 0201",
      role: "stylist",
      tier: "master",
      bio: "Master stylist focused on dimensional color, extensions, and corrective color journeys.",
      imagePath: "/images/salon/stylist-maya.webp",
      baseCommissionRate: 0.5,
      specializations: ["full-dimension-color", "gloss-toner-refresh", "signature-cut-blowout"]
    },
    {
      key: "leo-rivera",
      name: "Leo Rivera",
      email: "leo.rivera@morrowandmane.example",
      phone: "+1 843 555 0202",
      role: "stylist",
      tier: "senior",
      bio: "Precision cutter and blowout specialist for low-maintenance shapes and polished finishes.",
      imagePath: "/images/salon/stylist-leo.webp",
      baseCommissionRate: 0.45,
      specializations: ["signature-cut-blowout", "gloss-toner-refresh"]
    },
    {
      key: "priya-shah",
      name: "Priya Shah",
      email: "priya.shah@morrowandmane.example",
      phone: "+1 843 555 0203",
      role: "esthetician",
      tier: "senior",
      bio: "Esthetician focused on facials and skin care.",
      imagePath: "/images/salon/stylist-priya.webp",
      baseCommissionRate: 0.4,
      specializations: ["custom-clinical-facial"]
    }
  ],
  scheduleBlocks: [
    {
      key: "maya-weekdays",
      stylist: "maya-chen",
      type: "recurring",
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "13:00",
      breakEnd: "13:30",
      isAvailable: true
    },
    {
      key: "leo-cutting-week",
      stylist: "leo-rivera",
      type: "recurring",
      daysOfWeek: [1, 2, 3, 5, 6],
      startTime: "09:00",
      endTime: "17:00",
      breakStart: "12:30",
      breakEnd: "13:00",
      isAvailable: true
    },
    {
      key: "priya-spa-week",
      stylist: "priya-shah",
      type: "recurring",
      daysOfWeek: [2, 3, 4, 5, 6],
      startTime: "10:00",
      endTime: "18:00",
      breakStart: "14:00",
      breakEnd: "14:30",
      isAvailable: true
    }
  ],
  clients: [
    {
      key: "avery-stone",
      name: "Avery Stone",
      email: "avery.stone@example.test",
      phone: "+1 843 555 0301",
      preferredStylist: "maya-chen",
      hairType: "wavy",
      hairTexture: "medium",
      skinType: "combination",
      marketingConsent: true,
      notes: "Prefers lived-in blonde and quiet appointments."
    },
    {
      key: "jordan-lee",
      name: "Jordan Lee",
      email: "jordan.lee@example.test",
      phone: "+1 843 555 0302",
      preferredStylist: "leo-rivera",
      hairType: "straight",
      hairTexture: "fine",
      skinType: "combination",
      marketingConsent: true,
      notes: "Books precise cuts every six weeks."
    }
  ],
  intakeForms: [
    {
      key: "new-client-beauty-profile",
      name: "New Client Beauty Profile",
      requiredForServices: ["signature-cut-blowout", "full-dimension-color"],
      fields: [
        { id: "goals", type: "textarea", label: "Hair and skin goals", required: true },
        { id: "allergies", type: "textarea", label: "Allergies and sensitivities", required: false }
      ]
    }
  ],
  formTemplates: [
    {
      key: "color-chemical-consent",
      name: "Color + Chemical Consent",
      type: "consent",
      description: "Consent for color and chemical services.",
      requiredForCategories: ["Hair Services"],
      fields: [
        { id: "consent", type: "checkbox", label: "I consent to the selected color service", required: true },
        { id: "signature", type: "signature", label: "Signature", required: true }
      ]
    }
  ],
  memberships: [
    {
      key: "glow-club",
      name: "Glow Club",
      description: "Monthly self-care membership with service savings and priority booking.",
      monthlyPrice: 8900,
      discountPercent: 10,
      includedServices: ["signature-cut-blowout", "custom-clinical-facial"]
    },
    {
      key: "color-care-plan",
      name: "Color Care Plan",
      description: "Color maintenance plan with gloss refresh savings and retail perks.",
      monthlyPrice: 12900,
      discountPercent: 15,
      includedServices: ["gloss-toner-refresh", "full-dimension-color"]
    }
  ],
  packages: [
    {
      key: "color-care-package",
      name: "Color Care Package",
      description: "Three gloss refresh visits for maintained tone and shine.",
      totalPrice: 25500,
      savingsAmount: 3e3,
      validDays: 180,
      services: ["Gloss + Toner Refresh"]
    }
  ],
  products: [
    {
      key: "hydrate-shampoo",
      name: "Hydrate Shampoo",
      sku: "MM-HYDRATE-001",
      price: 3400,
      cost: 1400,
      quantity: 12,
      reorderPoint: 4,
      category: "Hair Care",
      description: "Sulfate-free hydration for color-treated hair."
    }
  ],
  messageTemplates: [
    {
      key: "appointment-reminder",
      name: "Appointment Reminder",
      type: "reminder",
      content: "Hi {{clientName}}, your Morrow & Mane appointment is {{appointmentDate}} with {{stylistName}}.",
      variables: ["clientName", "appointmentDate", "stylistName"]
    }
  ],
  appointments: [
    {
      key: "avery-color-follow-up",
      displayName: "Avery color follow-up",
      client: "avery-stone",
      stylist: "maya-chen",
      services: ["gloss-toner-refresh"],
      dayOffset: 2,
      time: "10:00",
      status: "confirmed",
      depositPaid: false,
      notes: "Color refresh and tone check."
    },
    {
      key: "jordan-precision-cut",
      displayName: "Jordan precision cut",
      client: "jordan-lee",
      stylist: "leo-rivera",
      services: ["signature-cut-blowout"],
      dayOffset: 1,
      time: "11:00",
      status: "completed",
      depositPaid: false,
      notes: "Six-week maintenance cut."
    }
  ],
  gallery: [
    {
      key: "dimensional-color-study",
      title: "Dimensional color study",
      caption: "Copper and honey ribbons developed at the color bar.",
      imagePath: "/images/salon/color-service.webp",
      service: "full-dimension-color"
    },
    {
      key: "polished-bob-finish",
      title: "Polished bob finish",
      caption: "A precise shape finished with quiet movement and shine.",
      imagePath: "/images/salon/haircut-detail.webp",
      service: "signature-cut-blowout"
    },
    {
      key: "clinical-facial-ritual",
      title: "Clinical facial ritual",
      caption: "A measured skin session built around consultation and recovery.",
      imagePath: "/images/salon/facial-treatment.webp",
      service: "custom-clinical-facial"
    },
    {
      key: "salon-color-bar",
      title: "The color bar",
      caption: "The working heart of Morrow & Mane's dimensional color services.",
      imagePath: "/images/salon/interior.webp"
    }
  ],
  paymentProviders: [
    {
      key: "manual-cash",
      name: "Manual / Cash",
      code: "pp_manual_cash",
      adapter: "manual",
      isInstalled: true,
      isDefault: true
    },
    {
      key: "stripe-provider",
      name: "Stripe",
      code: "pp_stripe",
      adapter: "stripe",
      isInstalled: false,
      isDefault: false
    }
  ]
};

// features/keystone/mutations/inventoryWorkflows.ts
var import_core67 = require("@keystone-6/core");

// features/keystone/inventory/movementReceipt.ts
var units = (value) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
function receiptMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function originalMovementResult(value, input) {
  const metadata = receiptMetadata(value.metadata);
  if (!value.id || value.idempotencyKey !== input.idempotencyKey || value.type !== input.type || value.delta !== input.delta || value.product?.id !== input.productId || value.location?.id !== input.locationId || (value.appointment?.id || null) !== (input.appointmentId || null) || value.reason !== input.reason.trim() || !units(value.balanceBefore) || !units(value.balanceAfter) || value.balanceBefore + input.delta !== value.balanceAfter || !units(metadata.aggregateQuantityBefore) || !units(metadata.aggregateQuantityAfter) || metadata.aggregateQuantityBefore + input.delta !== metadata.aggregateQuantityAfter) return null;
  return { success: true, movementId: value.id, balanceAfter: value.balanceAfter, error: null };
}

// features/keystone/inventory/stockFences.ts
var stockTransactions = /* @__PURE__ */ new WeakSet();
function registerStockTransaction(context) {
  stockTransactions.add(context);
}
function isStockTransaction(context) {
  return stockTransactions.has(context);
}
async function acquireStockLedgerFences(context, resources = [], receipts = []) {
  const keys = ["!writers", ...resources.flatMap(({ productId, locationId }) => [
    `product:${productId}`,
    `product-location:${JSON.stringify([productId, locationId])}`
  ]), ...receipts.map((key) => `receipt:${key}`)];
  for (const key of [...new Set(keys)].sort()) {
    await context.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "salon-stock-ledger", key);
  }
}

// features/keystone/mutations/inventoryWorkflows.ts
var denied3 = { success: false, movementId: null, balanceAfter: null };
var INVENTORY_RECOVERY_DELAYS_MS = [0, 50, 150];
function originalInventoryError(error) {
  return error instanceof Error ? error.message : "Inventory adjustment failed";
}
function opaqueProductLifecycleError(error) {
  return /Product\.hooks\.afterOperation: Prisma error/i.test(originalInventoryError(error));
}
function completedInventoryAdjustmentReplay(movement, product, input, currentLedgerQuantity) {
  const expectedType = input.delta > 0 ? "receive" : "adjustment";
  const metadata = movement?.metadata && typeof movement.metadata === "object" ? movement.metadata : {};
  if (!movement?.id || movement.idempotencyKey !== input.idempotencyKey || movement.product?.id !== input.productId || movement.location?.id !== input.locationId || movement.type !== expectedType || movement.delta !== input.delta || movement.reason !== input.reason.trim() || movement.appointment != null || !Number.isSafeInteger(movement.balanceBefore) || !Number.isSafeInteger(movement.balanceAfter) || movement.balanceBefore < 0 || movement.balanceAfter < 0 || movement.balanceBefore + movement.delta !== movement.balanceAfter || !Number.isSafeInteger(metadata.aggregateQuantityBefore) || !Number.isSafeInteger(metadata.aggregateQuantityAfter) || metadata.aggregateQuantityBefore < 0 || metadata.aggregateQuantityAfter < 0 || metadata.aggregateQuantityBefore + movement.delta !== metadata.aggregateQuantityAfter || product?.id !== input.productId || !Number.isSafeInteger(product.quantity) || product.quantity < 0 || product.quantity !== (currentLedgerQuantity ?? metadata.aggregateQuantityAfter)) return null;
  return { success: true, movementId: movement.id, balanceAfter: movement.balanceAfter, error: null };
}
async function recoverCompletedInventoryAdjustment(context, input, delaysMs = INVENTORY_RECOVERY_DELAYS_MS) {
  for (const delayMs of delaysMs.slice(0, INVENTORY_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      await assertStockLocation(context, input.locationId, "adjust");
      const sudo = context.sudo();
      const movements = await sudo.query.InventoryMovement.findMany({
        where: { idempotencyKey: { equals: input.idempotencyKey } },
        take: 2,
        query: "id idempotencyKey type delta balanceBefore balanceAfter reason metadata product { id } location { id } appointment { id }"
      });
      if (movements.length > 1) return null;
      if (movements.length === 1) {
        const metadata = receiptMetadata(movements[0].metadata);
        if (metadata.stockActorId != null && metadata.stockActorId !== context.session?.itemId || metadata.stockPurpose != null && metadata.stockPurpose !== "adjust") return null;
        const [product, aggregate] = await Promise.all([
          sudo.query.Product.findOne({ where: { id: input.productId }, query: "id quantity" }),
          context.prisma.inventoryMovement.aggregate({ where: { productId: input.productId }, _sum: { delta: true } })
        ]);
        if (!Number.isSafeInteger(aggregate._sum.delta) || aggregate._sum.delta < 0) return null;
        const result2 = completedInventoryAdjustmentReplay(movements[0], product, input, aggregate._sum.delta);
        if (!result2) return null;
        await assertStockLocation(context, movements[0].location.id, "adjust");
        return result2;
      }
    } catch {
      return null;
    }
  }
  return null;
}
function classifiedInventoryAdjustmentError(error, recovered) {
  return opaqueProductLifecycleError(error) && recovered ? recovered : { ...denied3, error: originalInventoryError(error) };
}
function validKey2(value) {
  return value.trim().length >= 12 && value.length <= 200;
}
async function recordInventoryMovement(context, input) {
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 1e6) {
    return { ...denied3, error: "Inventory delta must be a non-zero integer" };
  }
  if (!validKey2(input.idempotencyKey)) return { ...denied3, error: "Inventory idempotency key is invalid" };
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) return { ...denied3, error: "Inventory reason is required" };
  const purpose = input.purpose === "onboarding" ? "onboarding" : input.type === "sale" ? "checkout" : input.type === "return" ? "return" : "adjust";
  {
    if (!["sale", "return"].includes(input.type) && input.appointmentId || input.type === "sale" && (input.delta > 0 || !input.appointmentId) || input.type === "return" && (input.delta < 0 || !input.appointmentId || !input.metadata?.reversalId || !input.metadata?.sourceLineId) || input.type === "receive" && input.delta < 0) return { ...denied3, error: "Inventory purpose and parent input differ" };
    try {
      await assertStockLocation(context, input.locationId, purpose);
      if (isStockTransaction(context)) await acquireStockLedgerFences(context, [input], [input.idempotencyKey]);
    } catch {
      return { ...denied3, error: "Current inventory authority could not be verified" };
    }
  }
  const sudo = context.sudo();
  const existingRows = await sudo.query.InventoryMovement.findMany({
    where: { idempotencyKey: { equals: input.idempotencyKey } },
    take: 2,
    query: "id idempotencyKey type delta balanceBefore balanceAfter reason metadata product { id } location { id } appointment { id }"
  });
  if (existingRows.length) {
    const existing = existingRows[0];
    const result2 = existingRows.length === 1 ? originalMovementResult(existing, input) : null;
    if (!result2) return { ...denied3, error: "Inventory idempotency key was reused for another or incomplete movement" };
    try {
      await assertStockLocation(context, existing.location.id, purpose);
      const metadata = receiptMetadata(existing.metadata);
      if (metadata.source === "onboarding" !== (purpose === "onboarding") || metadata.stockActorId != null && metadata.stockActorId !== context.session?.itemId || metadata.stockPurpose != null && metadata.stockPurpose !== purpose) throw new Error("Original stock actor or purpose differs");
      if (input.type === "sale") {
        if (typeof metadata.transactionId !== "string") throw new Error("Original sale lineage is unavailable");
        const lines = await sudo.query.SalonTransactionLineItem.findMany({
          where: { transaction: { id: { equals: metadata.transactionId } }, product: { id: { equals: existing.product.id } } },
          take: 2,
          query: "id quantity product { id } transaction { id location { id } appointment { id } }"
        });
        if (lines.length !== 1 || lines[0].quantity !== -existing.delta || lines[0].product?.id !== existing.product.id || metadata.sourceLineId != null && lines[0].id !== metadata.sourceLineId || lines[0].transaction?.id !== metadata.transactionId || lines[0].transaction?.location?.id !== existing.location.id || lines[0].transaction?.appointment?.id !== existing.appointment?.id) throw new Error("Original sale lineage differs");
      }
      const [product2, ledger] = await Promise.all([
        sudo.query.Product.findOne({ where: { id: existing.product.id }, query: "id quantity" }),
        context.prisma.inventoryMovement.aggregate({ where: { productId: existing.product.id }, _sum: { delta: true } })
      ]);
      if (!product2 || product2.id !== existing.product.id || !Number.isSafeInteger(product2.quantity) || product2.quantity < 0 || product2.quantity !== ledger._sum.delta) throw new Error("Current aggregate ledger requires review");
      await assertStockLocation(context, existing.location.id, purpose);
      return result2;
    } catch {
      return { ...denied3, error: "Original inventory result could not be verified with current authority" };
    }
  }
  {
    if (!isStockTransaction(context)) return { ...denied3, error: "New stock writes require the native transaction workflow" };
    if (input.type === "sale") {
      const scope = input.appointmentId ? await assertCheckoutLocation(context, input.appointmentId) : null;
      if (!scope || scope.location.id !== input.locationId) return { ...denied3, error: "Sale location does not belong to the appointment" };
    }
    if (purpose === "onboarding" && (input.type !== "receive" || input.delta <= 0 || input.appointmentId || input.metadata?.source !== "onboarding")) {
      return { ...denied3, error: "Opening stock requires the explicit onboarding purpose" };
    }
  }
  const [product, location, locationLedger, aggregateLedger] = await Promise.all([
    sudo.query.Product.findOne({ where: { id: input.productId }, query: "id quantity isActive" }),
    sudo.query.Location.findOne({ where: { id: input.locationId }, query: "id isActive" }),
    // Authorized workflow + serializable transaction owns the ledger. Aggregate
    // deltas are independent of timestamp/commit ordering (including ties).
    context.prisma.inventoryMovement.aggregate({
      where: { productId: input.productId, locationId: input.locationId },
      _sum: { delta: true }
    }),
    context.prisma.inventoryMovement.aggregate({ where: { productId: input.productId }, _sum: { delta: true } })
  ]);
  if (!product || product.isActive === false) return { ...denied3, error: "Product is unavailable" };
  if (!location || location.isActive === false) return { ...denied3, error: "Location is unavailable" };
  if (!Number.isSafeInteger(product.quantity) || product.quantity < 0 || product.quantity !== (aggregateLedger._sum.delta ?? 0)) return { ...denied3, error: "Aggregate inventory requires explicit ledger review" };
  if (purpose === "onboarding" && (product.quantity !== 0 || (aggregateLedger._sum.delta ?? 0) !== 0)) return { ...denied3, error: "Opening inventory already has stock evidence" };
  const balanceBefore = Number(locationLedger._sum.delta || 0);
  const balanceAfter = balanceBefore + input.delta;
  if (balanceAfter < 0) return { ...denied3, error: "Location inventory cannot fall below zero" };
  const aggregateQuantity = Number(product.quantity || 0) + input.delta;
  if (aggregateQuantity < 0) return { ...denied3, error: "Aggregate inventory cannot fall below zero" };
  if (!Number.isSafeInteger(balanceBefore) || balanceBefore < 0 || !Number.isSafeInteger(balanceAfter) || balanceAfter > 2147483647 || !Number.isSafeInteger(aggregateQuantity) || aggregateQuantity > 2147483647) return { ...denied3, error: "Inventory arithmetic is outside the supported range" };
  await assertStockLocation(context, input.locationId, purpose);
  if (input.type === "return") {
    const source = await sudo.query.SalonTransactionLineItem.findOne({ where: { id: String(input.metadata.sourceLineId) }, query: "id quantity product { id } transaction { id location { id } appointment { id } }" });
    const reversal = await sudo.query.TransactionReversal.findOne({ where: { id: String(input.metadata.reversalId) }, query: "id type transaction { id }" });
    if (!source || !reversal || reversal.type === "compensation" || reversal.transaction?.id !== source.transaction?.id || source.product?.id !== input.productId || source.transaction?.location?.id !== input.locationId || source.transaction?.appointment?.id !== input.appointmentId || source.quantity < input.delta) return { ...denied3, error: "Return lineage does not match the source sale" };
  }
  await sudo.query.Product.updateOne({ where: { id: product.id }, data: { quantity: aggregateQuantity }, query: "id" });
  const movement = await sudo.query.InventoryMovement.createOne({
    data: {
      type: input.type,
      delta: input.delta,
      balanceBefore,
      balanceAfter,
      reason,
      idempotencyKey: input.idempotencyKey,
      product: { connect: { id: product.id } },
      location: { connect: { id: location.id } },
      appointment: input.appointmentId ? { connect: { id: input.appointmentId } } : void 0,
      metadata: {
        ...input.metadata || {},
        stockActorId: context.session.itemId,
        stockPurpose: purpose,
        aggregateQuantityBefore: Number(product.quantity || 0),
        aggregateQuantityAfter: aggregateQuantity
      }
    },
    query: "id"
  });
  return { success: true, movementId: movement.id, balanceAfter, error: null };
}
async function adjustSalonInventoryTransaction(context, input) {
  try {
    await currentStockContext(context, "adjust");
  } catch {
    return { ...denied3, error: "You must be an authorized salon operator" };
  }
  try {
    return await serializableWorkflow(context, "salon-inventory", [
      `product:${input.productId}`,
      `location:${input.locationId}`,
      `idempotency:${input.idempotencyKey}`
    ], async (transactionContext) => {
      registerStockTransaction(transactionContext);
      await acquireStockLedgerFences(transactionContext, [input], [input.idempotencyKey]);
      await assertStockLocation(transactionContext, input.locationId, "adjust");
      return recordInventoryMovement(transactionContext, {
        ...input,
        type: input.delta > 0 ? "receive" : "adjustment"
      });
    });
  } catch (error) {
    const recovered = opaqueProductLifecycleError(error) ? await recoverCompletedInventoryAdjustment(context, input) : null;
    return classifiedInventoryAdjustmentError(error, recovered);
  }
}
var resultType2 = import_core67.graphql.object()({
  name: "SalonInventoryResult",
  fields: {
    success: import_core67.graphql.field({ type: import_core67.graphql.nonNull(import_core67.graphql.Boolean) }),
    movementId: import_core67.graphql.field({ type: import_core67.graphql.ID }),
    balanceAfter: import_core67.graphql.field({ type: import_core67.graphql.Int }),
    error: import_core67.graphql.field({ type: import_core67.graphql.String })
  }
});
var adjustSalonInventory = import_core67.graphql.field({
  type: resultType2,
  args: {
    productId: import_core67.graphql.arg({ type: import_core67.graphql.nonNull(import_core67.graphql.ID) }),
    locationId: import_core67.graphql.arg({ type: import_core67.graphql.nonNull(import_core67.graphql.ID) }),
    delta: import_core67.graphql.arg({ type: import_core67.graphql.nonNull(import_core67.graphql.Int) }),
    reason: import_core67.graphql.arg({ type: import_core67.graphql.nonNull(import_core67.graphql.String) }),
    idempotencyKey: import_core67.graphql.arg({ type: import_core67.graphql.nonNull(import_core67.graphql.String) })
  },
  resolve(_source, args, context) {
    return adjustSalonInventoryTransaction(context, args);
  }
});

// features/keystone/scheduling/onboarding-date.ts
function onboardingAppointmentStart(item, timezone, now = /* @__PURE__ */ new Date()) {
  const offset = item.dayOffset ?? 1;
  if (!Number.isInteger(offset) || Math.abs(offset) > 366) {
    throw new Error("Appointment day offset must be an integer within 366 days");
  }
  const date2 = /* @__PURE__ */ new Date(`${zonedDateKey(now, timezone)}T00:00:00.000Z`);
  date2.setUTCDate(date2.getUTCDate() + offset);
  return zonedDateTimeToUtc(date2.toISOString().slice(0, 10), timeToMinutes(item.time || "10:00"), timezone);
}

// features/keystone/mutations/runSalonOnboarding.ts
var REQUIRED_ARRAYS = [
  "resources",
  "categories",
  "services",
  "stylists",
  "scheduleBlocks",
  "clients",
  "intakeForms",
  "formTemplates",
  "memberships",
  "packages",
  "products",
  "messageTemplates",
  "appointments",
  "gallery",
  "paymentProviders"
];
function validateSeed(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Salon seed must be an object");
  const seed = input;
  if (!seed.salonInfo || typeof seed.salonInfo !== "object" || Array.isArray(seed.salonInfo)) {
    throw new Error("Salon seed requires salonInfo");
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(seed[key])) throw new Error(`Salon seed requires ${key}`);
    if (seed[key].length > 500) throw new Error(`Salon seed ${key} exceeds the 500-item limit`);
  }
  const imagePaths = [
    ...seed.services.map((item) => item.imagePath),
    ...seed.stylists.map((item) => item.imagePath),
    ...seed.gallery.map((item) => item.imagePath)
  ].filter(Boolean);
  if (imagePaths.some((value) => typeof value !== "string" || !/^\/images\/[a-z0-9_./-]+$/i.test(value) || value.includes(".."))) {
    throw new Error("Salon seed image paths must be canonical relative /images/ paths");
  }
  parseStorefrontHue(seed.salonInfo.themeHue);
  if (typeof seed.salonInfo.name !== "string" || !seed.salonInfo.name.trim() || seed.salonInfo.name.trim().length > 120) {
    throw new Error("Salon seed storefront name must be between 1 and 120 characters");
  }
  if (typeof seed.salonInfo.description !== "string" || seed.salonInfo.description.trim().length > 240) {
    throw new Error("Salon seed storefront description must be 240 characters or fewer");
  }
  for (const service of seed.services) {
    if (!Number.isInteger(service.price) || service.price <= 0 || !Number.isInteger(service.basePrice)) {
      throw new Error(`Service ${service.name || "unknown"} prices must be integer cents`);
    }
  }
  for (const [section, fields] of Object.entries({
    memberships: ["monthlyPrice"],
    packages: ["totalPrice", "savingsAmount"],
    products: ["price", "cost"]
  })) {
    for (const item of seed[section]) {
      for (const field of fields) {
        if (item[field] != null && !Number.isInteger(item[field])) {
          throw new Error(`${section}.${field} must be integer cents`);
        }
      }
    }
  }
  return seed;
}
async function runSalonOnboardingTransaction(context, seedInput = seed_default, failurePoint) {
  const userId = context.session?.itemId;
  if (!userId) throw new Error("You do not have permission to run salon onboarding");
  await currentStockContext(context, "onboarding");
  const seed = validateSeed(seedInput);
  return context.transaction(async (transactionContext) => {
    await acquireSalonCapacityFence(transactionContext);
    registerStockTransaction(transactionContext);
    await currentStockContext(transactionContext, "onboarding");
    await acquireStockLedgerFences(transactionContext);
    await transactionContext.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "salon-authoritative-onboarding"
    );
    await assertCurrentWorkflowAuthority(transactionContext);
    const sudo = transactionContext.sudo();
    let created = 0;
    let reused = 0;
    const findOne = async (list59, where, query = "id") => {
      const rows = await sudo.query[list59].findMany({ where, take: 1, query });
      return rows[0] || null;
    };
    const createOne = async (list59, data, query = "id") => {
      created += 1;
      return sudo.query[list59].createOne({ data, query });
    };
    const updateOne = async (list59, id, data, query = "id") => {
      reused += 1;
      return sudo.query[list59].updateOne({ where: { id }, data, query });
    };
    const salon = seed.salonInfo;
    const locationData = {
      name: salon.name,
      address: salon.address,
      city: salon.city,
      state: salon.state,
      zipCode: salon.zipCode,
      phone: salon.phone,
      email: salon.email,
      timezone: salon.timezone,
      hours: salon.hours,
      isActive: true
    };
    const existingLocation = await findOne("Location", { name: { equals: salon.name } });
    const location = existingLocation ? await updateOne("Location", existingLocation.id, locationData) : await createOne("Location", locationData);
    const storeSettingsData = {
      scope: STOREFRONT_SETTINGS_SCOPE,
      name: salon.name,
      description: salon.description || "",
      themeHue: parseStorefrontHue(salon.themeHue),
      primaryLocation: { connect: { id: location.id } }
    };
    const existingStoreSettings = await findOne("StoreSettings", { scope: { equals: STOREFRONT_SETTINGS_SCOPE } });
    if (existingStoreSettings) await updateOne("StoreSettings", existingStoreSettings.id, storeSettingsData);
    else await createOne("StoreSettings", storeSettingsData);
    const resourceIds = {};
    for (const item of seed.resources) {
      const data = {
        name: item.name,
        type: item.type || "station",
        capacity: item.capacity || 1,
        isActive: item.isActive ?? true,
        notes: item.notes || "",
        metadata: { ...item.metadata || {}, seedKey: item.key, source: "onboarding" },
        location: { connect: { id: location.id } }
      };
      const existing = await findOne("SalonResource", { name: { equals: item.name } });
      const record = existing ? await updateOne("SalonResource", existing.id, data) : await createOne("SalonResource", data);
      resourceIds[item.key] = record.id;
    }
    if (failurePoint === "resources") throw new Error("Injected onboarding failure after resources");
    const categoryIds = {};
    for (const item of seed.categories) {
      const data = {
        name: item.name,
        description: item.description || "",
        slug: item.slug,
        displayOrder: item.displayOrder || 0,
        sortOrder: item.displayOrder || 0,
        isVisible: true,
        icon: item.icon || ""
      };
      const existing = await findOne("ServiceCategory", { slug: { equals: item.slug } });
      const record = existing ? await updateOne("ServiceCategory", existing.id, data) : await createOne("ServiceCategory", data);
      categoryIds[item.key] = record.id;
      categoryIds[item.name] = record.id;
    }
    const imageByPath = async (imagePath, altText, metadata) => {
      const seedKey = typeof metadata.seedKey === "string" ? metadata.seedKey : null;
      const seededImages2 = seedKey ? await sudo.query.SalonImage.findMany({ take: 500, query: "id metadata" }) : [];
      const seeded = seededImages2.find((image2) => image2.metadata?.seedKey === seedKey);
      const existing = seeded || (!seedKey ? await findOne("SalonImage", { imagePath: { equals: imagePath } }) : null);
      const data = { imagePath, altText, visibility: "public", metadata: { ...metadata, source: "onboarding" } };
      return existing ? updateOne("SalonImage", existing.id, data) : createOne("SalonImage", data);
    };
    const serviceIds = {};
    const serviceRecords = {};
    for (const item of seed.services) {
      const image2 = item.imagePath ? await imageByPath(item.imagePath, item.name, { seedKey: `service-image:${item.key}`, placement: "service" }) : null;
      const resourceConnections = (item.requiredResources || []).map((key) => resourceIds[key]).filter(Boolean).map((id) => ({ id }));
      const data = {
        name: item.name,
        description: item.description || "",
        baseDuration: item.baseDuration,
        price: item.price,
        basePrice: item.basePrice,
        depositRequired: item.depositRequired ?? false,
        depositAmount: item.depositAmount || 0,
        status: "active",
        metadata: { ...item.metadata || {}, seedKey: item.key, source: "onboarding" },
        category: categoryIds[item.category] ? { connect: { id: categoryIds[item.category] } } : void 0,
        requiredResources: { connect: resourceConnections },
        image: image2 ? { connect: { id: image2.id } } : void 0
      };
      const existing = await findOne("Service", { name: { equals: item.name } });
      const record = existing ? await updateOne("Service", existing.id, data, "id name price basePrice baseDuration image { imagePath image { url } }") : await createOne("Service", data, "id name price basePrice baseDuration image { imagePath image { url } }");
      serviceIds[item.key] = record.id;
      serviceRecords[item.key] = record;
    }
    if (failurePoint === "services") throw new Error("Injected onboarding failure after services");
    const userIds = {};
    const ensureUser = async (person) => {
      const existing = await findOne("User", { email: { equals: person.email } }, "id name email");
      if (existing) {
        reused += 1;
        userIds[person.key] = existing.id;
        return existing;
      }
      const user = await createOne("User", {
        name: person.name,
        email: person.email,
        phone: person.phone || "",
        password: `seed_${crypto.randomUUID()}_${crypto.randomUUID()}`
      }, "id name email");
      userIds[person.key] = user.id;
      return user;
    };
    const stylistIds = {};
    for (const item of seed.stylists) {
      const user = await ensureUser(item);
      const image2 = item.imagePath ? await imageByPath(item.imagePath, item.name, { seedKey: `stylist-image:${item.key}`, placement: "stylist" }) : null;
      const specializations = (item.specializations || []).map((key) => serviceIds[key]).filter(Boolean).map((id) => ({ id }));
      const data = {
        user: { connect: { id: user.id } },
        role: item.role || "stylist",
        tier: item.tier || "senior",
        bio: item.bio || "",
        baseCommissionRate: item.baseCommissionRate ?? 0.4,
        commissionRate: item.baseCommissionRate ?? 0.4,
        status: "active",
        isActive: true,
        photoUrl: item.imagePath || "",
        photo: image2 ? { connect: { id: image2.id } } : void 0,
        specializations: { connect: specializations },
        locations: { connect: [{ id: location.id }] }
      };
      const existing = await findOne("Stylist", { user: { id: { equals: user.id } } });
      const record = existing ? await updateOne("Stylist", existing.id, data) : await createOne("Stylist", data);
      stylistIds[item.key] = record.id;
    }
    for (const block of seed.scheduleBlocks) {
      const stylistId = stylistIds[block.stylist];
      for (const dayOfWeek of block.daysOfWeek || []) {
        const where = {
          stylist: { id: { equals: stylistId } },
          location: { id: { equals: location.id } },
          dayOfWeek: { equals: dayOfWeek },
          startTime: { equals: block.startTime },
          endTime: { equals: block.endTime },
          type: { equals: "recurring" }
        };
        const existing = await findOne("StylistSchedule", where);
        const data = {
          type: "recurring",
          dayOfWeek,
          startTime: block.startTime,
          endTime: block.endTime,
          breakStart: block.breakStart || "",
          breakEnd: block.breakEnd || "",
          isAvailable: block.isAvailable ?? true,
          stylist: { connect: { id: stylistId } },
          location: { connect: { id: location.id } },
          idempotencyKey: `onboarding:schedule:${block.stylist}:${dayOfWeek}:${block.startTime}-${block.endTime}`
        };
        if (existing) await updateOne("StylistSchedule", existing.id, data);
        else await createOne("StylistSchedule", data);
      }
    }
    const clientIds = {};
    for (const item of seed.clients) {
      const user = await ensureUser(item);
      const data = {
        user: { connect: { id: user.id } },
        homeLocation: { connect: { id: location.id } },
        preferredStylist: item.preferredStylist && stylistIds[item.preferredStylist] ? { connect: { id: stylistIds[item.preferredStylist] } } : void 0,
        hairType: item.hairType,
        hairTexture: item.hairTexture,
        skinType: item.skinType,
        notes: item.notes || "",
        marketingConsent: item.marketingConsent ?? false
        // Visit/value counters use model defaults on creation; replay must preserve earned totals.
      };
      const existing = await findOne("Client", { user: { id: { equals: user.id } } });
      const record = existing ? await updateOne("Client", existing.id, data) : await createOne("Client", data);
      clientIds[item.key] = record.id;
    }
    if (failurePoint === "people") throw new Error("Injected onboarding failure after people");
    for (const item of seed.intakeForms) {
      const services = (item.requiredForServices || []).map((key) => serviceIds[key]).filter(Boolean).map((id) => ({ id }));
      const data = { name: item.name, fields: item.fields, isActive: true, requiredForServices: { connect: services } };
      const existing = await findOne("IntakeForm", { name: { equals: item.name } });
      if (existing) await updateOne("IntakeForm", existing.id, data);
      else await createOne("IntakeForm", data);
    }
    for (const item of seed.formTemplates) {
      const data = { name: item.name, type: item.type, description: item.description || "", fields: item.fields, isActive: true };
      const existing = await findOne("FormTemplate", { name: { equals: item.name } });
      if (existing) await updateOne("FormTemplate", existing.id, data);
      else await createOne("FormTemplate", data);
    }
    for (const item of seed.memberships) {
      const services = (item.includedServices || []).map((key) => serviceIds[key]).filter(Boolean).map((id) => ({ id }));
      const data = { name: item.name, description: item.description || "", monthlyPrice: item.monthlyPrice, discountPercent: item.discountPercent, isActive: true, includedServices: { connect: services } };
      const existing = await findOne("Membership", { name: { equals: item.name } });
      if (existing) await updateOne("Membership", existing.id, data);
      else await createOne("Membership", data);
    }
    for (const item of seed.packages) {
      const services = (item.services || []).map((key) => serviceIds[key] || Object.entries(serviceRecords).find(([, service]) => service.name === key)?.[1]?.id).filter(Boolean).map((id) => ({ id }));
      const data = { name: item.name, description: item.description || "", totalPrice: item.totalPrice, savingsAmount: item.savingsAmount, validDays: item.validDays, isActive: true, services: { connect: services } };
      const existing = await findOne("ServicePackage", { name: { equals: item.name } });
      if (existing) await updateOne("ServicePackage", existing.id, data);
      else await createOne("ServicePackage", data);
    }
    for (const item of seed.products) {
      const data = { name: item.name, sku: item.sku, price: item.price, cost: item.cost, quantity: item.quantity, reorderPoint: item.reorderPoint, category: item.category, description: item.description || "", isActive: true };
      const existing = await findOne("Product", { sku: { equals: item.sku } });
      if (existing) {
        const { quantity: _seedQuantity, ...catalogData } = data;
        await updateOne("Product", existing.id, catalogData);
      } else {
        const openingQuantity = Math.max(0, Number(item.quantity || 0));
        const product = await createOne("Product", { ...data, quantity: 0 });
        if (openingQuantity > 0) {
          const movement = await recordInventoryMovement(transactionContext, {
            productId: product.id,
            locationId: location.id,
            type: "receive",
            purpose: "onboarding",
            delta: openingQuantity,
            reason: "Opening inventory received during salon onboarding",
            idempotencyKey: `onboarding:inventory:${item.key}:${location.id}`,
            metadata: { source: "onboarding", seedKey: item.key }
          });
          if (!movement.success) throw new Error(movement.error || "Unable to establish opening inventory");
        }
      }
    }
    for (const item of seed.messageTemplates) {
      const data = { name: item.name, type: item.type, content: item.content, variables: item.variables, isActive: true };
      const existing = await findOne("MessageTemplate", { name: { equals: item.name } });
      if (existing) await updateOne("MessageTemplate", existing.id, data);
      else await createOne("MessageTemplate", data);
    }
    for (const item of seed.gallery) {
      await imageByPath(item.imagePath, item.title, {
        seedKey: `gallery:${item.key}`,
        placement: "gallery",
        title: item.title,
        caption: item.caption,
        serviceId: item.service ? serviceIds[item.service] : null
      });
    }
    const seededImages = await sudo.query.SalonImage.findMany({ take: 500, query: "id metadata createdAt" });
    const imagesBySeedKey = /* @__PURE__ */ new Map();
    for (const image2 of seededImages) {
      const key = typeof image2.metadata?.seedKey === "string" ? image2.metadata.seedKey : null;
      if (key) imagesBySeedKey.set(key, [...imagesBySeedKey.get(key) || [], image2]);
    }
    const prisma = transactionContext.prisma;
    for (const duplicates of imagesBySeedKey.values()) {
      if (duplicates.length < 2) continue;
      const ranked = await Promise.all(duplicates.map(async (image2) => ({
        image: image2,
        references: await prisma.service.count({ where: { imageId: image2.id } }) + await prisma.stylist.count({ where: { photoId: image2.id } }) + await prisma.colorFormula.count({ where: { photoId: image2.id } }) + await prisma.product.count({ where: { imageId: image2.id } }) + await prisma.clientNote.count({ where: { photos: { some: { id: image2.id } } } })
      })));
      ranked.sort((a, b) => b.references - a.references || String(a.image.createdAt).localeCompare(String(b.image.createdAt)));
      for (const duplicate of ranked.slice(1)) {
        if (duplicate.references === 0) await sudo.query.SalonImage.deleteOne({ where: { id: duplicate.image.id }, query: "id" });
      }
    }
    const existingAppointments = await sudo.query.Appointment.findMany({ take: 500, query: "id metadata" });
    for (const item of seed.appointments) {
      const existing = existingAppointments.find((appointment) => appointment.metadata?.seedKey === item.key);
      if (existing) {
        reused += 1;
        continue;
      }
      const services = (item.services || []).map((key) => serviceRecords[key]).filter(Boolean);
      const duration = services.reduce((sum, service) => sum + Number(service.baseDuration || 0), 0) || 60;
      const start = onboardingAppointmentStart(item, salon.timezone);
      const end = new Date(start.getTime() + duration * 6e4);
      await createOne("Appointment", {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration,
        status: item.status || "confirmed",
        depositPaid: item.depositPaid ?? false,
        metadata: { seedKey: item.key, source: "onboarding" },
        notes: item.notes || "",
        location: { connect: { id: location.id } },
        client: clientIds[item.client] ? { connect: { id: clientIds[item.client] } } : void 0,
        stylist: stylistIds[item.stylist] ? { connect: { id: stylistIds[item.stylist] } } : void 0,
        services: { connect: services.map((service) => ({ id: service.id })) },
        lineItems: { create: services.map((service) => {
          const snapshot2 = captureServiceSnapshot(service);
          return {
            service: { connect: { id: service.id } },
            staff: stylistIds[item.stylist] ? { connect: { id: stylistIds[item.stylist] } } : void 0,
            serviceTitle: snapshot2.serviceTitle,
            serviceImagePath: snapshot2.serviceImagePath,
            duration: snapshot2.duration,
            price: snapshot2.price,
            quantity: 1,
            notes: item.notes || "",
            metadata: {
              seedKey: `${item.key}:${service.id}`,
              source: "onboarding",
              snapshotVersion: 1,
              serviceName: snapshot2.serviceTitle,
              serviceImagePath: snapshot2.serviceImagePath
            }
          };
        }) }
      });
    }
    if (failurePoint === "appointments") throw new Error("Injected onboarding failure after appointments");
    for (const item of seed.paymentProviders) {
      const data = {
        name: item.name,
        code: item.code,
        adapter: item.adapter,
        isInstalled: item.isInstalled ?? false,
        isDefault: item.isDefault ?? false,
        config: item.config || {}
      };
      const existing = await findOne("PaymentProvider", { code: { equals: item.code } });
      if (existing) await updateOne("PaymentProvider", existing.id, data);
      else await createOne("PaymentProvider", data);
    }
    await sudo.query.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: "completed" },
      query: "id"
    });
    return { success: true, completed: true, created, reused, locationId: location.id, error: null };
  }, { maxWait: 5e3, timeout: 12e4, isolationLevel: "Serializable" });
}
var resultType3 = import_core68.graphql.object()({
  name: "RunSalonOnboardingResult",
  fields: {
    success: import_core68.graphql.field({ type: import_core68.graphql.nonNull(import_core68.graphql.Boolean) }),
    completed: import_core68.graphql.field({ type: import_core68.graphql.nonNull(import_core68.graphql.Boolean) }),
    created: import_core68.graphql.field({ type: import_core68.graphql.nonNull(import_core68.graphql.Int) }),
    reused: import_core68.graphql.field({ type: import_core68.graphql.nonNull(import_core68.graphql.Int) }),
    locationId: import_core68.graphql.field({ type: import_core68.graphql.ID }),
    error: import_core68.graphql.field({ type: import_core68.graphql.String })
  }
});
var runSalonOnboarding = import_core68.graphql.field({
  type: resultType3,
  args: { seed: import_core68.graphql.arg({ type: import_core68.graphql.JSON }) },
  async resolve(_source, { seed }, context) {
    return runSalonOnboardingTransaction(context, seed ?? seed_default);
  }
});

// features/keystone/mutations/completeAppointmentCheckout.ts
var import_node_crypto5 = require("node:crypto");
var import_core69 = require("@keystone-6/core");

// features/keystone/inventory/originalCheckoutScope.ts
async function originalCheckoutScope(context, appointmentId, idempotencyKey) {
  const current = await currentStockContext(context, "checkout");
  const rows = await current.query.PaymentSession.findMany({
    where: { idempotencyKey: { equals: idempotencyKey } },
    take: 2,
    query: "id appointment { id transaction { id location { id } } }"
  });
  if (!rows.length) return null;
  const parent = rows[0].appointment?.transaction;
  if (rows.length !== 1 || !rows[0].id || rows[0].appointment?.id !== appointmentId || !parent?.id || !parent.location?.id) throw new Error("Original checkout lineage is unavailable");
  const scope = await assertStockLocation(current, parent.location.id, "checkout");
  const originals = await scope.context.query.PaymentSession.findMany({
    where: { id: { equals: rows[0].id } },
    take: 2,
    query: "id data appointment { id transaction { id location { id } } }"
  });
  const original = originals[0];
  if (originals.length !== 1 || original.id !== rows[0].id || original.appointment?.id !== appointmentId || original.appointment?.transaction?.id !== parent.id || original.appointment?.transaction?.location?.id !== parent.location.id) throw new Error("Original checkout parent changed");
  const data = original.data && typeof original.data === "object" && !Array.isArray(original.data) ? original.data : {};
  if (data.originalTransactionId != null && data.originalTransactionId !== parent.id || data.originalLocationId != null && data.originalLocationId !== parent.location.id || data.stockActorId != null && data.stockActorId !== current.session?.itemId) throw new Error("Original checkout lineage or actor differs");
  await assertStockLocation(context, parent.location.id, "checkout");
  return { ...scope, transactionId: parent.id };
}

// features/keystone/settlement.ts
function cents2(value, label = "Amount") {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1e9) throw new Error(`${label} must be nonnegative integer cents`);
  return value;
}
function allocateCents(amount, weights) {
  cents2(amount);
  const entries = Object.entries(weights).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((sum, [, value]) => sum + cents2(value), 0);
  if (amount > total) throw new Error("Adjustment exceeds eligible remaining value");
  const result2 = {};
  let remaining = amount;
  for (const [id, weight] of entries) {
    const share = total ? Number(BigInt(amount) * BigInt(weight) / BigInt(total)) : 0;
    result2[id] = share;
    remaining -= share;
  }
  for (const [id, weight] of entries) if (remaining && result2[id] < weight) {
    result2[id]++;
    remaining--;
  }
  if (remaining !== 0) throw new Error("Allocation did not conserve cents");
  return result2;
}
function checkoutSettlement(input) {
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0 || input.taxRate > 1) throw new Error("Tax configuration must be between zero and one");
  if (!Number.isFinite(input.membershipPercent) || input.membershipPercent < 0 || input.membershipPercent > 100) throw new Error("Membership discount is invalid");
  const membershipIds = new Set(input.membershipServices), packageIds = new Set(input.packageServices);
  const membership = {}, remaining = {};
  for (const line of input.lines) {
    cents2(line.amount);
    membership[line.id] = line.serviceId && membershipIds.has(line.serviceId) ? Math.round(line.amount * input.membershipPercent / 100) : 0;
    remaining[line.id] = line.amount - membership[line.id];
  }
  const manual = allocateCents(input.manualDiscount, remaining);
  const discounts = {}, packageWeights = {};
  for (const line of input.lines) {
    discounts[line.id] = membership[line.id] + manual[line.id];
    remaining[line.id] -= manual[line.id];
    packageWeights[line.id] = line.serviceId && packageIds.has(line.serviceId) ? remaining[line.id] : 0;
  }
  const subtotal = input.lines.reduce((sum, line) => sum + line.amount, 0);
  const discount = Object.values(discounts).reduce((sum, value) => sum + value, 0);
  const membershipDiscount = Object.values(membership).reduce((sum, value) => sum + value, 0);
  const taxable = subtotal - discount;
  const tax = cents2(Math.round(taxable * input.taxRate)), tip = cents2(input.tip);
  const packageCredit = Math.min(cents2(input.packageAvailable), Object.values(packageWeights).reduce((sum, value) => sum + value, 0));
  const packageAllocations = allocateCents(packageCredit, packageWeights);
  const grossTotal = cents2(taxable + tax + tip);
  const depositCredit = Math.min(cents2(input.depositAvailable), grossTotal - packageCredit);
  const total = grossTotal - packageCredit - depositCredit;
  return { subtotal, taxable, discount, membershipDiscount, discounts, tax, tip, grossTotal, packageCredit, packageAllocations, depositCredit, total, unappliedDeposit: input.depositAvailable - depositCredit };
}

// features/keystone/checkoutBoundaries.ts
function assertNoUnreconciledPackageUsage(usageCount) {
  if (!Number.isSafeInteger(usageCount) || usageCount < 0) {
    throw new Error("Package usage evidence is invalid");
  }
  if (usageCount > 0) {
    throw new Error("Existing standalone package usage requires reconciliation before checkout; no second debit was made");
  }
}

// features/keystone/depositBoundaries.ts
var UNRESOLVED_PAYMENT_SESSION_STATUSES = /* @__PURE__ */ new Set(["pending", "requires_action", "authorized"]);
var RECONCILED_PAYMENT_SESSION_STATUSES = /* @__PURE__ */ new Set([
  "completed",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded"
]);
function assertNoUnresolvedAppointmentPaymentSessions(sessions) {
  for (const session of sessions) {
    if (typeof session.status !== "string") {
      throw new Error("Payment session status is unknown; reconcile it before checkout");
    }
    if (UNRESOLVED_PAYMENT_SESSION_STATUSES.has(session.status)) {
      throw new Error("An unresolved payment attempt must be reconciled before checkout");
    }
    if (!RECONCILED_PAYMENT_SESSION_STATUSES.has(session.status)) {
      throw new Error("Payment session status is unknown; reconcile it before checkout");
    }
  }
}

// features/keystone/mutations/completeAppointmentCheckout.ts
var TAX_RATE2 = Number.parseFloat(process.env.TAX_RATE || "0.08");
var CHECKOUT_RECOVERY_DELAYS_MS = [0, 50, 150];
function checkoutRequestHash(args, retail) {
  return (0, import_node_crypto5.createHash)("sha256").update(JSON.stringify({
    appointmentId: args.appointmentId,
    paymentMethod: args.paymentMethod,
    tipAmount: args.tipAmount,
    discountAmount: args.discountAmount,
    clientPackageId: args.clientPackageId || null,
    clientMembershipId: args.clientMembershipId || null,
    retail: [...retail].sort((left, right) => left.productId.localeCompare(right.productId))
  })).digest("hex");
}
function completedCheckoutResult(session, appointmentId, requestHash, scope) {
  const payment = session?.payment;
  const appointment = session?.appointment;
  const transaction = appointment?.transaction;
  const paymentTransaction2 = payment?.appointment?.transaction;
  if (!session || session.status !== "completed" || !session.completedAt || session.data?.source !== "controlled_checkout" || session.data?.checkoutRequestHash !== requestHash || appointment?.id !== appointmentId || appointment.status !== "completed" || !transaction?.id || transaction.status !== "completed" || transaction.paymentStatus !== "paid" || !transaction.completedAt || !payment?.id || payment.status !== "completed" || !payment.processedAt || payment.session?.id !== session.id || payment.appointment?.id !== appointmentId || paymentTransaction2?.id !== transaction.id || transaction.id !== scope.transactionId || transaction.location?.id !== scope.location.id || session.data?.originalTransactionId != null && session.data.originalTransactionId !== transaction.id || session.data?.originalLocationId != null && session.data.originalLocationId !== transaction.location.id || !Number.isInteger(session.amount) || !Number.isInteger(payment.totalAmount) || session.amount !== payment.totalAmount) return null;
  return { success: true, transactionId: transaction.id, paymentId: payment.id, error: null };
}
async function recoverCompletedCheckoutByIdempotency(context, appointmentId, idempotencyKey, requestHash, delaysMs = CHECKOUT_RECOVERY_DELAYS_MS) {
  for (const delayMs of delaysMs.slice(0, CHECKOUT_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const scope = await originalCheckoutScope(context, appointmentId, idempotencyKey);
      if (!scope) continue;
      const sessions = await context.sudo().query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: idempotencyKey } },
        take: 2,
        query: `id idempotencyKey status amount completedAt data
          appointment { id status transaction { id status paymentStatus completedAt location { id } } }
          payment { id status totalAmount processedAt session { id } appointment { id transaction { id } } }
        `
      });
      if (sessions.length > 0) return sessions.length === 1 ? completedCheckoutResult(sessions[0], appointmentId, requestHash, scope) : null;
    } catch {
    }
  }
  return null;
}
function parseRetail(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > 50) throw new Error("Too many retail items");
  const quantities = /* @__PURE__ */ new Map();
  for (const item of input) {
    const productId = String(item?.productId || "");
    const quantity = Number(item?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1e3) throw new Error("Retail quantity is invalid");
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
async function completeAppointmentCheckoutTransaction(context, args) {
  try {
    await currentStockContext(context, "checkout");
  } catch {
    return { success: false, transactionId: null, paymentId: null, error: "You must be an authorized salon operator" };
  }
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12) {
    return { success: false, transactionId: null, paymentId: null, error: "A valid idempotency key is required" };
  }
  let retail;
  try {
    if (!["cash", "credit_card", "debit_card"].includes(args.paymentMethod)) throw new Error("Only cash or an already-collected external terminal payment can be recorded; gift cards require a supported allocated tender");
    retail = parseRetail(args.retailItems);
    if (!Number.isInteger(args.tipAmount) || !Number.isInteger(args.discountAmount) || args.tipAmount < 0 || args.discountAmount < 0 || args.tipAmount > 1e7 || args.discountAmount > 1e7) {
      throw new Error("Checkout amounts must be nonnegative integer cents");
    }
  } catch (error) {
    return { success: false, transactionId: null, paymentId: null, error: error instanceof Error ? error.message : "Invalid checkout input" };
  }
  const requestHash = checkoutRequestHash(args, retail);
  try {
    return await serializableWorkflow(context, "salon-domain-resource", [
      `appointment:${args.appointmentId}`,
      `checkout:${args.idempotencyKey}`,
      ...args.clientPackageId ? [`package:${args.clientPackageId}`] : [],
      ...args.clientMembershipId ? [`membership:${args.clientMembershipId}`] : [],
      ...retail.map((item) => `product:${item.productId}`)
    ], async (transactionContext) => {
      registerStockTransaction(transactionContext);
      await acquireStockLedgerFences(transactionContext);
      const originalScope = await originalCheckoutScope(transactionContext, args.appointmentId, args.idempotencyKey);
      const stockScope = originalScope || await assertCheckoutLocation(transactionContext, args.appointmentId);
      await acquireStockLedgerFences(transactionContext, retail.map((item) => ({ productId: item.productId, locationId: stockScope.location.id })), retail.map((item) => `${args.idempotencyKey}:inventory:${item.productId}`));
      const sudo = transactionContext.sudo();
      const existing = await sudo.query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        take: 2,
        query: `id idempotencyKey status amount completedAt data
          appointment { id status transaction { id status paymentStatus completedAt location { id } } }
          payment { id status totalAmount processedAt session { id } appointment { id transaction { id } } }
        `
      });
      if (existing.length > 0) {
        const completed = existing.length === 1 && originalScope ? completedCheckoutResult(existing[0], args.appointmentId, requestHash, originalScope) : null;
        if (!completed) throw new Error("Checkout idempotency key is attached to an incomplete or mismatched settlement");
        return completed;
      }
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: `
          id status depositAmount depositPaid payment { id } transaction { id } location { id name isActive }
          client { id lifetimeValue totalVisits user { id email } }
          stylist { id baseCommissionRate user { id } }
          lineItems { id serviceTitle serviceImagePath price quantity duration service { id } staff { id baseCommissionRate } }
        `
      });
      if (!appointment) throw new Error("Appointment not found");
      const checkoutLocationId = stockScope.location.id;
      if (appointment.location?.id !== checkoutLocationId || appointment.location.isActive !== true) throw new Error("Appointment location is unavailable; reconcile its assignment before checkout");
      if (!["confirmed", "in_progress"].includes(appointment.status || "")) throw new Error("Appointment is not eligible for checkout");
      if (appointment.payment?.id || appointment.transaction?.id) throw new Error("Appointment is already checked out");
      if (!appointment.lineItems.length) throw new Error("Appointment has no payable line items");
      const priorPackageUsage = await sudo.query.ClientPackageUsage.count({ where: { appointment: { id: { equals: appointment.id } } } });
      assertNoUnreconciledPackageUsage(priorPackageUsage);
      const pendingPaymentSessions = await sudo.query.PaymentSession.findMany({
        where: {
          appointment: { id: { equals: appointment.id } },
          status: { in: ["pending", "requires_action", "authorized"] }
        },
        take: 100,
        query: "id status"
      });
      assertNoUnresolvedAppointmentPaymentSessions(pendingPaymentSessions);
      const products = retail.length ? await sudo.query.Product.findMany({
        where: { id: { in: retail.map((item) => item.productId) }, isActive: { equals: true } },
        query: "id name sku price quantity image { imagePath image { url } }"
      }) : [];
      const retailLines = retail.map((requested) => {
        const product = products.find((item) => item.id === requested.productId);
        if (!product || (product.quantity || 0) < requested.quantity) throw new Error("Retail product is unavailable");
        return { ...requested, product, unitPrice: product.price || 0 };
      });
      const serviceSubtotal = appointment.lineItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
      const retailSubtotal = retailLines.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const bookedServiceIds = new Set(appointment.lineItems.map((item) => item.service?.id));
      let membershipPercent = 0;
      let membershipServices = [];
      if ((args.clientMembershipId || args.clientPackageId) && !appointment.client?.user?.id) throw new Error("Benefits require a verified linked client");
      if (args.clientMembershipId && appointment.client?.user?.id) {
        const membership = await sudo.query.ClientMembership.findOne({
          where: { id: args.clientMembershipId },
          query: "id status startDate pausedUntil client { id } membership { isActive discountPercent includedServices { id } }"
        });
        const paused = membership?.pausedUntil && new Date(membership.pausedUntil).getTime() > Date.now();
        if (!membership || membership.status !== "active" || paused || !membership.membership?.isActive || new Date(membership.startDate).getTime() > Date.now() || membership.client?.id !== appointment.client.user.id) throw new Error("Membership is not available for this client");
        if (!membership.membership?.includedServices?.some((service) => bookedServiceIds.has(service.id))) throw new Error("Membership does not cover this appointment");
        membershipPercent = membership.membership?.discountPercent || 0;
        membershipServices = membership.membership.includedServices.map((service) => service.id);
      }
      let packageAvailable = 0;
      let packageServices = [];
      let clientPackage = null;
      if (args.clientPackageId && appointment.client?.user?.id) {
        clientPackage = await sudo.query.ClientPackage.findOne({
          where: { id: args.clientPackageId },
          query: "id status totalValue usedValue expiresAt client { id } package { services { id } }"
        });
        if (!clientPackage || clientPackage.status !== "active" || clientPackage.expiresAt && new Date(clientPackage.expiresAt).getTime() <= Date.now() || clientPackage.client?.id !== appointment.client.user.id) throw new Error("Package is not available for this client");
        if (!clientPackage.package?.services?.some((service) => bookedServiceIds.has(service.id))) throw new Error("Package does not cover this appointment");
        packageAvailable = Math.max(0, (clientPackage.totalValue || 0) - (clientPackage.usedValue || 0));
        packageServices = clientPackage.package.services.map((service) => service.id);
      }
      const depositSessions = await sudo.query.PaymentSession.findMany({
        where: { appointment: { id: { equals: appointment.id } } },
        take: 100,
        query: "id status data payment { id status totalAmount refundedAmount }"
      });
      const depositSources = depositSessions.filter((session2) => session2.data?.purpose === "appointment_deposit" && ["completed", "partially_refunded"].includes(session2.payment?.status));
      const depositAvailable = depositSources.reduce((sum, session2) => sum + Math.max(0, session2.payment.totalAmount - (session2.payment.refundedAmount || 0)), 0);
      if (appointment.depositPaid && !depositSources.length) throw new Error("Paid deposit has no captured payment evidence; reconcile it before checkout");
      const settlement = checkoutSettlement({
        lines: [
          ...appointment.lineItems.map((item) => ({ id: item.id, amount: (item.price || 0) * (item.quantity || 1), serviceId: item.service?.id })),
          ...retailLines.map((item) => ({ id: `retail:${item.productId}`, amount: item.unitPrice * item.quantity }))
        ],
        manualDiscount: args.discountAmount,
        membershipPercent,
        membershipServices,
        packageAvailable,
        packageServices,
        depositAvailable,
        taxRate: TAX_RATE2,
        tip: args.tipAmount
      });
      const { subtotal, taxable, discount, packageCredit, tax, tip, depositCredit, total } = settlement;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const transaction = await sudo.query.SalonTransaction.createOne({
        data: {
          type: "appointment",
          location: { connect: { id: checkoutLocationId } },
          client: appointment.client?.id ? { connect: { id: appointment.client.id } } : void 0,
          appointment: { connect: { id: appointment.id } },
          staff: appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : void 0,
          tip,
          paymentMethod: packageCredit > 0 || depositCredit > 0 ? "split" : args.paymentMethod === "cash" ? "cash" : "card",
          paymentStatus: "paid",
          status: "completed",
          completedAt: now,
          metadata: { source: "controlled_checkout", settlementVersion: 2, currency: "USD", taxRate: TAX_RATE2, serviceSubtotal, retailSubtotal, ...settlement, depositSources: depositSources.map((session2) => ({ sessionId: session2.id, available: session2.payment.totalAmount - (session2.payment.refundedAmount || 0) })) }
        },
        query: "id"
      });
      for (const item of appointment.lineItems) {
        await sudo.query.SalonTransactionLineItem.createOne({
          data: {
            transaction: { connect: { id: transaction.id } },
            itemType: "service",
            service: item.service?.id ? { connect: { id: item.service.id } } : void 0,
            staff: item.staff?.id ? { connect: { id: item.staff.id } } : appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : void 0,
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            discount: settlement.discounts[item.id],
            commissionRate: item.staff?.baseCommissionRate ?? appointment.stylist?.baseCommissionRate ?? 0,
            metadata: { snapshotType: "settled_service", title: item.serviceTitle, imagePath: item.serviceImagePath, duration: item.duration, packageCents: settlement.packageAllocations[item.id] || 0 }
          },
          query: "id"
        });
      }
      for (const item of retailLines) {
        const imagePath = item.product.image?.image?.url || item.product.image?.imagePath || "";
        const retailLine = await sudo.query.SalonTransactionLineItem.createOne({
          data: {
            transaction: { connect: { id: transaction.id } },
            itemType: "product",
            product: { connect: { id: item.product.id } },
            staff: appointment.stylist?.id ? { connect: { id: appointment.stylist.id } } : void 0,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: settlement.discounts[`retail:${item.productId}`],
            commissionRate: 0,
            metadata: { snapshotType: "settled_product", title: item.product.name, sku: item.product.sku, imagePath }
          },
          query: "id"
        });
        const movement = await recordInventoryMovement(transactionContext, {
          productId: item.product.id,
          locationId: checkoutLocationId,
          appointmentId: appointment.id,
          type: "sale",
          delta: -item.quantity,
          reason: `Retail sale at appointment checkout ${appointment.id}`,
          idempotencyKey: `${args.idempotencyKey}:inventory:${item.product.id}`,
          metadata: { source: "controlled_checkout", transactionId: transaction.id, sourceLineId: retailLine.id }
        });
        if (!movement.success) throw new Error(movement.error || "Inventory movement failed");
      }
      const providers = await sudo.query.PaymentProvider.findMany({
        where: { adapter: { equals: "manual" }, isInstalled: { equals: true } },
        take: 1,
        query: "id code adapter config"
      });
      const provider = providers[0];
      if (!provider) throw new Error("Operator payment provider is unavailable");
      const providerConfig = paymentProviderFromRecord(provider);
      const initiated = await createProviderPaymentSession({ provider: providerConfig, amount: total, currency: "usd", idempotencyKey: args.idempotencyKey, metadata: { appointmentId: appointment.id, operatorId: context.session.itemId } });
      const confirmed = await confirmProviderPayment({ provider: providerConfig, providerReference: initiated.providerReference, amount: total, idempotencyKey: `${args.idempotencyKey}:confirm` });
      if (confirmed.status !== "completed") throw new Error("Operator payment was not completed");
      const session = await sudo.query.PaymentSession.createOne({
        data: { appointment: { connect: { id: appointment.id } }, provider: { connect: { id: provider.id } }, idempotencyKey: args.idempotencyKey, amount: total, currency: "usd", status: "completed", providerReference: initiated.providerReference, completedAt: now, data: { ...initiated.data || {}, ...confirmed.data || {}, source: "controlled_checkout", checkoutRequestHash: requestHash, originalTransactionId: transaction.id, originalLocationId: checkoutLocationId, stockActorId: context.session.itemId } },
        query: "id"
      });
      const payment = await sudo.query.Payment.createOne({
        data: { appointment: { connect: { id: appointment.id } }, session: { connect: { id: session.id } }, subtotal, tax, tip, discount, totalAmount: total, paymentMethod: args.paymentMethod, status: "completed", processedAt: now, processedBy: { connect: { id: context.session.itemId } }, receiptEmail: appointment.client?.user?.email || "", notes: "Recorded by controlled appointment checkout" },
        query: "id"
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
      if (retailLines.length) {
        await sudo.query.ProductSale.createOne({
          data: { appointment: { connect: { id: appointment.id } }, products: retailLines.map((item) => ({ productId: item.product.id, name: item.product.name, sku: item.product.sku, quantity: item.quantity, price: item.unitPrice, subtotal: item.unitPrice * item.quantity })), total: retailSubtotal, soldBy: appointment.stylist?.user?.id ? { connect: { id: appointment.stylist.user.id } } : void 0 },
          query: "id"
        });
      }
      for (const item of appointment.lineItems) {
        const stylistId = item.staff?.id || appointment.stylist?.id;
        const rate = item.staff?.baseCommissionRate ?? appointment.stylist?.baseCommissionRate ?? 0;
        if (!stylistId || !item.service?.id || rate <= 0) continue;
        const saleAmount = (item.price || 0) * (item.quantity || 1) - settlement.discounts[item.id];
        await sudo.query.Commission.createOne({ data: { stylist: { connect: { id: stylistId } }, service: { connect: { id: item.service.id } }, payment: { connect: { id: payment.id } }, saleAmount, commissionRate: rate, commissionAmount: Math.round(saleAmount * rate), isPaid: false, notes: "Generated by controlled checkout" }, query: "id" });
      }
      if (tip > 0) {
        const domain3 = sudo.query;
        const weights = /* @__PURE__ */ new Map();
        for (const item of appointment.lineItems) {
          const stylistId = item.staff?.id || appointment.stylist?.id;
          if (stylistId) weights.set(stylistId, (weights.get(stylistId) || 0) + (item.price || 0) * (item.quantity || 1));
        }
        const recipients = [...weights.entries()];
        if (recipients.length === 0) throw new Error("Tip cannot be conserved without an assigned practitioner");
        const totalWeight = recipients.reduce((sum, [, weight]) => sum + weight, 0);
        let allocated = 0;
        for (let index = 0; index < recipients.length; index += 1) {
          const [stylistId, weight] = recipients[index];
          const amount = index === recipients.length - 1 ? tip - allocated : Math.floor(tip * weight / Math.max(1, totalWeight));
          allocated += amount;
          await domain3.GratuityLedgerEntry.createOne({ data: {
            payment: { connect: { id: payment.id } },
            practitioner: { connect: { id: stylistId } },
            type: "allocation",
            amountDelta: amount,
            payoutStatus: "payable",
            reason: "Controlled checkout gratuity allocation",
            actor: { connect: { id: context.session.itemId } },
            postedAt: now,
            idempotencyKey: `${args.idempotencyKey}:tip:${stylistId}`,
            evidence: { allocationBasis: "service_line_value", totalTip: tip, weight, totalWeight }
          }, query: "id" });
        }
        if (allocated !== tip) throw new Error("Tip allocation failed cents conservation");
      }
      if (clientPackage && packageCredit > 0) {
        const usedValue = (clientPackage.usedValue || 0) + packageCredit;
        await sudo.query.ClientPackage.updateOne({ where: { id: clientPackage.id }, data: { usedValue, status: usedValue >= (clientPackage.totalValue || 0) ? "fully-used" : "active" }, query: "id" });
        const packageServiceIds = appointment.lineItems.reduce((ids2, item) => {
          const serviceId = item.service?.id;
          if ((settlement.packageAllocations[item.id] || 0) > 0 && typeof serviceId === "string" && !ids2.includes(serviceId)) ids2.push(serviceId);
          return ids2;
        }, []);
        await sudo.query.ClientPackageUsage.createOne({ data: {
          clientPackage: { connect: { id: clientPackage.id } },
          appointment: { connect: { id: appointment.id } },
          // A service relation is meaningful only when all allocated value maps
          // to exactly one service; per-line amounts remain on settled sale lines.
          service: packageServiceIds.length === 1 ? { connect: { id: packageServiceIds[0] } } : void 0,
          quantityUsed: 1,
          valueUsed: packageCredit,
          idempotencyKey: `${args.idempotencyKey}:package`
        }, query: "id" });
      }
      if (appointment.client?.id) {
        await sudo.query.Client.updateOne({ where: { id: appointment.client.id }, data: { lifetimeValue: (appointment.client.lifetimeValue || 0) + taxable, totalVisits: (appointment.client.totalVisits || 0) + 1, lastVisit: now }, query: "id" });
      }
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data: { status: "completed" }, query: "id" });
      const segments = await sudo.query.AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["planned", "started"] } }, take: 200, query: "id" });
      for (const segment of segments) await sudo.query.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "completed" }, query: "id" });
      return { success: true, transactionId: transaction.id, paymentId: payment.id, error: null };
    });
  } catch (error) {
    const recovered = await recoverCompletedCheckoutByIdempotency(context, args.appointmentId, args.idempotencyKey, requestHash);
    if (recovered) return recovered;
    console.error("Controlled appointment checkout failed", error);
    return { success: false, transactionId: null, paymentId: null, error: error instanceof Error ? error.message : "Checkout failed" };
  }
}
var resultType4 = import_core69.graphql.object()({
  name: "CompleteAppointmentCheckoutResult",
  fields: {
    success: import_core69.graphql.field({ type: import_core69.graphql.nonNull(import_core69.graphql.Boolean) }),
    transactionId: import_core69.graphql.field({ type: import_core69.graphql.ID }),
    paymentId: import_core69.graphql.field({ type: import_core69.graphql.ID }),
    error: import_core69.graphql.field({ type: import_core69.graphql.String })
  }
});
var completeAppointmentCheckout = import_core69.graphql.field({
  type: resultType4,
  args: {
    appointmentId: import_core69.graphql.arg({ type: import_core69.graphql.nonNull(import_core69.graphql.ID) }),
    paymentMethod: import_core69.graphql.arg({ type: import_core69.graphql.nonNull(import_core69.graphql.String) }),
    tipAmount: import_core69.graphql.arg({ type: import_core69.graphql.nonNull(import_core69.graphql.Int) }),
    discountAmount: import_core69.graphql.arg({ type: import_core69.graphql.nonNull(import_core69.graphql.Int) }),
    retailItems: import_core69.graphql.arg({ type: import_core69.graphql.JSON }),
    clientPackageId: import_core69.graphql.arg({ type: import_core69.graphql.ID }),
    clientMembershipId: import_core69.graphql.arg({ type: import_core69.graphql.ID }),
    idempotencyKey: import_core69.graphql.arg({ type: import_core69.graphql.nonNull(import_core69.graphql.String) })
  },
  resolve(_source, args, context) {
    return completeAppointmentCheckoutTransaction(context, args);
  }
});

// features/keystone/mutations/appointmentWorkflows.ts
var import_core70 = require("@keystone-6/core");
var transitions2 = {
  pending: ["confirmed", "cancelled", "no_show"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["cancelled"]
};
function isOperator(context) {
  return permissions.canManageAppointments({ session: context.session });
}
function errorMessage(error) {
  return error instanceof Error ? error.message : "Appointment workflow failed";
}
function assertEffectiveClientPolicy(snapshot2, action) {
  const now = Date.now();
  if (!snapshot2?.version || !snapshot2?.effectiveFrom) throw new Error(`Online ${action} requires an accepted effective policy snapshot`);
  if (snapshot2.revokedAt) throw new Error(`Online ${action} policy has been revoked; contact the salon`);
  if (new Date(snapshot2.effectiveFrom).getTime() > now || snapshot2.effectiveUntil && new Date(snapshot2.effectiveUntil).getTime() <= now) {
    throw new Error(`Online ${action} policy is not currently effective; contact the salon`);
  }
  const deadline = snapshot2[`${action}Deadline`];
  if (!isPolicyDeadlineOpen(deadline, now)) throw new Error(`Online ${action} is outside the accepted policy window; contact the salon`);
}
async function transitionAppointmentTransaction(context, args) {
  const reason = args.reason?.trim() || "";
  if (!context.session?.itemId) return { success: false, appointmentId: null, status: null, error: "You must be signed in" };
  if (!(args.status in { confirmed: 1, in_progress: 1, cancelled: 1, no_show: 1 })) {
    return { success: false, appointmentId: null, status: null, error: "Unsupported appointment transition" };
  }
  if (reason.length > 1e3) return { success: false, appointmentId: null, status: null, error: "Transition reason is too long" };
  if (args.status === "cancelled" && !reason) return { success: false, appointmentId: null, status: null, error: "A cancellation reason is required" };
  try {
    return await serializableWorkflow(context, "salon-appointment-transition", [`appointment:${args.appointmentId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status metadata client { user { id } } payment { id status refundedAmount totalAmount } transaction { id }"
      });
      if (!appointment) throw new Error("Appointment not found");
      const operator2 = isOperator(context);
      const owner = appointment.client?.user?.id === context.session.itemId;
      if (!operator2 && !(owner && args.status === "cancelled")) throw new Error("You cannot transition this appointment");
      const metadata = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata : {};
      if (owner && !operator2 && args.status === "cancelled") assertEffectiveClientPolicy(metadata.clientPolicySnapshot, "cancellation");
      if (appointment.status === args.status) {
        return { success: true, appointmentId: appointment.id, status: appointment.status, error: null };
      }
      if (!(transitions2[appointment.status || ""] || []).includes(args.status)) {
        throw new Error(`Cannot transition appointment from ${appointment.status || "unknown"} to ${args.status}`);
      }
      if (args.status === "in_progress" && appointment.transaction?.id) throw new Error("Checked-out appointments cannot be restarted");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const history = Array.isArray(metadata.transitionHistory) ? metadata.transitionHistory.slice(-49) : [];
      const data = {
        status: args.status,
        metadata: {
          ...metadata,
          transitionHistory: [...history, {
            from: appointment.status,
            to: args.status,
            reason: reason || null,
            actorId: context.session.itemId,
            at: now
          }]
        }
      };
      if (args.status === "confirmed") data.confirmedAt = now;
      if (args.status === "cancelled") {
        data.cancelledAt = now;
        data.cancellationReason = reason;
      }
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data, query: "id" });
      if (["cancelled", "no_show"].includes(args.status)) {
        const segments = await sudo.query.AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["planned", "started"] } }, take: 200, query: "id" });
        for (const segment of segments) await sudo.query.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "skipped" }, query: "id" });
      }
      return { success: true, appointmentId: appointment.id, status: args.status, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, status: null, error: errorMessage(error) };
  }
}
var transitionResult = import_core70.graphql.object()({
  name: "TransitionAppointmentResult",
  fields: {
    success: import_core70.graphql.field({ type: import_core70.graphql.nonNull(import_core70.graphql.Boolean) }),
    appointmentId: import_core70.graphql.field({ type: import_core70.graphql.ID }),
    status: import_core70.graphql.field({ type: import_core70.graphql.String }),
    error: import_core70.graphql.field({ type: import_core70.graphql.String })
  }
});
var transitionAppointment = import_core70.graphql.field({
  type: transitionResult,
  args: {
    appointmentId: import_core70.graphql.arg({ type: import_core70.graphql.nonNull(import_core70.graphql.ID) }),
    status: import_core70.graphql.arg({ type: import_core70.graphql.nonNull(import_core70.graphql.String) }),
    reason: import_core70.graphql.arg({ type: import_core70.graphql.String })
  },
  resolve(_source, args, context) {
    return transitionAppointmentTransaction(context, args);
  }
});
async function processAppointmentDepositTransaction(context, args) {
  if (!isOperator(context)) return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "You must be an authorized salon operator" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12 || args.idempotencyKey.length > 200) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "Idempotency key is invalid" };
  }
  if (!(/* @__PURE__ */ new Set(["credit_card", "debit_card", "cash", "apple_pay", "google_pay"])).has(args.paymentMethod)) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: "Payment method is invalid" };
  }
  try {
    return await serializableWorkflow(context, "salon-domain-resource", [
      `appointment:${args.appointmentId}`,
      `idempotency:${args.idempotencyKey}`
    ], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.PaymentSession.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        take: 1,
        query: "id amount status data appointment { id } payment { id }"
      }))[0];
      if (existing) {
        const data = existing.data && typeof existing.data === "object" ? existing.data : {};
        if (existing.appointment?.id !== args.appointmentId || data.purpose !== "appointment_deposit") {
          throw new Error("Idempotency key was already used for another operation");
        }
        return { success: true, appointmentId: args.appointmentId, paymentId: existing.payment?.id || null, paymentSessionId: existing.id, status: existing.status, error: null };
      }
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status depositAmount depositPaid client { user { email } }"
      });
      if (!appointment) throw new Error("Appointment not found");
      if (!(/* @__PURE__ */ new Set(["pending", "confirmed"])).has(appointment.status || "")) throw new Error("Appointment is not eligible for a deposit");
      if (appointment.depositPaid) throw new Error("Appointment deposit is already paid");
      const pendingSessions = await sudo.query.PaymentSession.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ["pending", "requires_action", "authorized"] } }, take: 100, query: "id data" });
      if (pendingSessions.some((session2) => session2.data?.purpose === "appointment_deposit")) throw new Error("Reconcile the existing deposit attempt before collecting another");
      const amount = Number(appointment.depositAmount || 0);
      if (!Number.isInteger(amount) || amount <= 0) throw new Error("Appointment does not require a deposit");
      const providers = await sudo.query.PaymentProvider.findMany({
        where: args.providerCode ? { code: { equals: args.providerCode }, isInstalled: { equals: true } } : { isInstalled: { equals: true }, isDefault: { equals: true } },
        take: 1,
        query: "id code adapter config"
      });
      const provider = providers[0];
      if (!provider) throw new Error("Payment provider is unavailable");
      if (provider.adapter !== "manual") throw new Error("Integrated online deposit collection is not available; record an externally collected deposit with the manual provider");
      const result2 = await createProviderPaymentSession({
        provider: paymentProviderFromRecord(provider),
        amount,
        currency: "usd",
        idempotencyKey: args.idempotencyKey,
        metadata: { purpose: "appointment_deposit", appointmentId: appointment.id, operatorId: context.session.itemId }
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const session = await sudo.query.PaymentSession.createOne({
        data: {
          appointment: { connect: { id: appointment.id } },
          provider: { connect: { id: provider.id } },
          idempotencyKey: args.idempotencyKey,
          amount,
          currency: "usd",
          status: result2.status,
          providerReference: result2.providerReference,
          completedAt: result2.status === "completed" ? now : void 0,
          data: { ...result2.data || {}, purpose: "appointment_deposit", clientSecret: result2.clientSecret || null }
        },
        query: "id"
      });
      const payment = await sudo.query.Payment.createOne({
        data: {
          subtotal: amount,
          tax: 0,
          tip: 0,
          discount: 0,
          totalAmount: amount,
          paymentMethod: args.paymentMethod,
          status: paymentRecordStatus(result2.status),
          session: { connect: { id: session.id } },
          processedBy: { connect: { id: context.session.itemId } },
          processedAt: result2.status === "completed" ? now : void 0,
          receiptEmail: appointment.client?.user?.email || "",
          notes: `Appointment deposit for ${appointment.id}`
        },
        query: "id"
      });
      await sudo.query.PaymentSession.updateOne({ where: { id: session.id }, data: { payment: { connect: { id: payment.id } } }, query: "id" });
      if (result2.status === "completed") {
        await sudo.query.Appointment.updateOne({
          where: { id: appointment.id },
          data: { depositPaid: true, ...appointment.status === "pending" ? { status: "confirmed", confirmedAt: now } : {} },
          query: "id"
        });
      }
      return { success: true, appointmentId: appointment.id, paymentId: payment.id, paymentSessionId: session.id, status: result2.status, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, paymentId: null, paymentSessionId: null, status: null, error: errorMessage(error) };
  }
}
var depositResult = import_core70.graphql.object()({
  name: "ProcessAppointmentDepositResult",
  fields: {
    success: import_core70.graphql.field({ type: import_core70.graphql.nonNull(import_core70.graphql.Boolean) }),
    appointmentId: import_core70.graphql.field({ type: import_core70.graphql.ID }),
    paymentId: import_core70.graphql.field({ type: import_core70.graphql.ID }),
    paymentSessionId: import_core70.graphql.field({ type: import_core70.graphql.ID }),
    status: import_core70.graphql.field({ type: import_core70.graphql.String }),
    error: import_core70.graphql.field({ type: import_core70.graphql.String })
  }
});
var processAppointmentDeposit = import_core70.graphql.field({
  type: depositResult,
  args: {
    appointmentId: import_core70.graphql.arg({ type: import_core70.graphql.nonNull(import_core70.graphql.ID) }),
    paymentMethod: import_core70.graphql.arg({ type: import_core70.graphql.nonNull(import_core70.graphql.String) }),
    providerCode: import_core70.graphql.arg({ type: import_core70.graphql.String }),
    idempotencyKey: import_core70.graphql.arg({ type: import_core70.graphql.nonNull(import_core70.graphql.String) })
  },
  resolve(_source, args, context) {
    return processAppointmentDepositTransaction(context, args);
  }
});

// features/keystone/mutations/packageWorkflows.ts
var import_core71 = require("@keystone-6/core");
async function redeemClientPackageTransaction(context, args) {
  const denied11 = { success: false, clientPackageId: null, usageId: null, usedValue: null, remainingValue: null, status: null };
  if (!permissions.canManagePayments({ session: context.session })) return { ...denied11, error: "You must have payment authority" };
  if (!Number.isInteger(args.valueUsed) || args.valueUsed <= 0 || args.valueUsed > 1e7) return { ...denied11, error: "Package usage must be positive integer cents" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12 || args.idempotencyKey.length > 200) return { ...denied11, error: "Idempotency key is invalid" };
  try {
    return await serializableWorkflow(context, "salon-domain-resource", [
      `appointment:${args.appointmentId}`,
      `package:${args.clientPackageId}`,
      `idempotency:${args.idempotencyKey}`
    ], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const existing = (await sudo.query.ClientPackageUsage.findMany({
        where: { idempotencyKey: { equals: args.idempotencyKey } },
        take: 1,
        query: "id valueUsed clientPackage { id totalValue usedValue status } appointment { id } service { id }"
      }))[0];
      if (existing) {
        if (existing.clientPackage?.id !== args.clientPackageId || existing.appointment?.id !== args.appointmentId || existing.service?.id !== args.serviceId || existing.valueUsed !== args.valueUsed) {
          throw new Error("Idempotency key was already used for another package operation");
        }
        return {
          success: true,
          clientPackageId: args.clientPackageId,
          usageId: existing.id,
          usedValue: existing.clientPackage.usedValue,
          remainingValue: Math.max(0, existing.clientPackage.totalValue - existing.clientPackage.usedValue),
          status: existing.clientPackage.status,
          error: null
        };
      }
      const clientPackage = await sudo.query.ClientPackage.findOne({
        where: { id: args.clientPackageId },
        query: "id status totalValue usedValue expiresAt client { id } package { services { id } }"
      });
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status client { user { id } } lineItems { service { id } price quantity }"
      });
      if (!clientPackage || !appointment) throw new Error("Package or appointment not found");
      if (!(/* @__PURE__ */ new Set(["confirmed", "in_progress"])).has(appointment.status || "")) throw new Error("Appointment is not eligible for package usage");
      if (clientPackage.status !== "active") throw new Error("Package is not active");
      if (clientPackage.expiresAt && new Date(clientPackage.expiresAt).getTime() <= Date.now()) throw new Error("Package has expired");
      if (!appointment.client?.user?.id || clientPackage.client?.id !== appointment.client.user.id) throw new Error("Package does not belong to the appointment client");
      if (!clientPackage.package?.services?.some((service) => service.id === args.serviceId)) throw new Error("Package does not cover this service");
      const line = appointment.lineItems.find((item) => item.service?.id === args.serviceId);
      if (!line) throw new Error("Service is not part of the appointment");
      const lineValue = Number(line.price || 0) * Number(line.quantity || 1);
      const remaining = Math.max(0, Number(clientPackage.totalValue || 0) - Number(clientPackage.usedValue || 0));
      if (args.valueUsed > remaining || args.valueUsed > lineValue) throw new Error("Package usage exceeds the available value");
      const usedValue = Number(clientPackage.usedValue || 0) + args.valueUsed;
      const status = usedValue >= Number(clientPackage.totalValue || 0) ? "fully-used" : "active";
      await sudo.query.ClientPackage.updateOne({ where: { id: clientPackage.id }, data: { usedValue, status }, query: "id" });
      const usage = await sudo.query.ClientPackageUsage.createOne({
        data: {
          clientPackage: { connect: { id: clientPackage.id } },
          appointment: { connect: { id: appointment.id } },
          service: { connect: { id: args.serviceId } },
          quantityUsed: 1,
          valueUsed: args.valueUsed,
          idempotencyKey: args.idempotencyKey
        },
        query: "id"
      });
      return { success: true, clientPackageId: clientPackage.id, usageId: usage.id, usedValue, remainingValue: Math.max(0, Number(clientPackage.totalValue || 0) - usedValue), status, error: null };
    });
  } catch (error) {
    return { ...denied11, error: error instanceof Error ? error.message : "Package usage failed" };
  }
}
var resultType5 = import_core71.graphql.object()({
  name: "RedeemClientPackageResult",
  fields: {
    success: import_core71.graphql.field({ type: import_core71.graphql.nonNull(import_core71.graphql.Boolean) }),
    clientPackageId: import_core71.graphql.field({ type: import_core71.graphql.ID }),
    usageId: import_core71.graphql.field({ type: import_core71.graphql.ID }),
    usedValue: import_core71.graphql.field({ type: import_core71.graphql.Int }),
    remainingValue: import_core71.graphql.field({ type: import_core71.graphql.Int }),
    status: import_core71.graphql.field({ type: import_core71.graphql.String }),
    error: import_core71.graphql.field({ type: import_core71.graphql.String })
  }
});
var redeemClientPackage = import_core71.graphql.field({
  type: resultType5,
  args: {
    clientPackageId: import_core71.graphql.arg({ type: import_core71.graphql.nonNull(import_core71.graphql.ID) }),
    appointmentId: import_core71.graphql.arg({ type: import_core71.graphql.nonNull(import_core71.graphql.ID) }),
    serviceId: import_core71.graphql.arg({ type: import_core71.graphql.nonNull(import_core71.graphql.ID) }),
    valueUsed: import_core71.graphql.arg({ type: import_core71.graphql.nonNull(import_core71.graphql.Int) }),
    idempotencyKey: import_core71.graphql.arg({ type: import_core71.graphql.nonNull(import_core71.graphql.String) })
  },
  resolve(_source, args, context) {
    return redeemClientPackageTransaction(context, args);
  }
});

// features/keystone/mutations/waitlistWorkflows.ts
var import_core72 = require("@keystone-6/core");
var denied4 = { success: false, waitlistEntryId: null, status: null };
function operator(context) {
  return permissions.canManageAppointments({ session: context.session }) || permissions.canManageClients({ session: context.session });
}
var operatorDenied = () => new Error("You must be an authorized salon operator");
async function freshWaitlistContext(context) {
  const itemId = context.session?.itemId;
  if (typeof itemId !== "string" || !itemId || context.session?.listKey !== "User") throw operatorDenied();
  const actor = await context.query.User.findOne({
    where: { id: itemId },
    query: "id role { id name canManageSalon canManageAppointments canManageClients }"
  });
  if (!actor || actor.id !== itemId || !actor.role) throw operatorDenied();
  const session = { ...context.session, data: { ...context.session.data, role: actor.role } };
  if (!permissions.canManageAppointments({ session }) && !permissions.canManageClients({ session })) throw operatorDenied();
  return context.withSession(session);
}
function parseDate(value) {
  if (!value) return null;
  const date2 = new Date(value);
  if (Number.isNaN(date2.getTime())) throw new Error("Waitlist date range is invalid");
  return date2;
}
async function joinWaitlistTransaction(context, args) {
  if (!operator(context)) return { ...denied4, error: "You must be an authorized salon operator" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.length < 12 || args.idempotencyKey.length > 200) return { ...denied4, error: "Idempotency key is invalid" };
  const notes = args.notes?.trim() || "";
  const preferredTimeRange = args.preferredTimeRange?.trim() || "";
  const guestName = args.guestName?.trim() || "";
  const guestPhone = args.guestPhone?.trim() || "";
  if (!args.clientId && !guestName) return { ...denied4, error: "A client or walk-in name is required" };
  if (guestName.length > 120 || guestPhone.length > 40 || notes.length > 2e3 || preferredTimeRange.length > 120) return { ...denied4, error: "Waitlist details are too long" };
  const preferredDays = Array.isArray(args.preferredDays) ? [...new Set(args.preferredDays.map(String))] : [];
  const allowedDays = /* @__PURE__ */ new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  if (preferredDays.length > 7 || preferredDays.some((day) => !allowedDays.has(day.toLowerCase()))) return { ...denied4, error: "Preferred days are invalid" };
  let start;
  let end;
  try {
    start = parseDate(args.dateRangeStart);
    end = parseDate(args.dateRangeEnd);
    if (start && end && end <= start) throw new Error("Waitlist end date must follow its start date");
    if (end && end.getTime() > Date.now() + 366 * 24 * 60 * 6e4) throw new Error("Waitlist date range is too far in the future");
  } catch (error) {
    return { ...denied4, error: error instanceof Error ? error.message : "Waitlist date range is invalid" };
  }
  const stylistIds = [...new Set((args.preferredStylistIds || []).filter(Boolean))];
  if (stylistIds.length > 20) return { ...denied4, error: "Too many preferred stylists" };
  try {
    return await serializableWorkflow(context, "salon-waitlist", [
      `client-service:${args.clientId || `${guestName}:${guestPhone}`}:${args.serviceId}`,
      `request:${args.idempotencyKey}`
    ], async (transactionContext) => {
      const current = await freshWaitlistContext(transactionContext);
      const sudo = current.sudo();
      const existing = (await sudo.query.WaitlistEntry.findMany({
        where: { requestKey: { equals: args.idempotencyKey } },
        take: 1,
        query: "id status guestName guestPhone client { id } service { id }"
      }))[0];
      if (existing) {
        if ((existing.client?.id || null) !== (args.clientId || null) || existing.service?.id !== args.serviceId || !args.clientId && (existing.guestName !== guestName || (existing.guestPhone || "") !== guestPhone)) {
          throw new Error("Idempotency key was already used for another waitlist request");
        }
        return { success: true, waitlistEntryId: existing.id, status: existing.status, error: null };
      }
      const [client, service, stylists] = await Promise.all([
        args.clientId ? sudo.query.User.findOne({ where: { id: args.clientId }, query: "id" }) : Promise.resolve(null),
        sudo.query.Service.findOne({ where: { id: args.serviceId }, query: "id status" }),
        stylistIds.length ? sudo.query.Stylist.findMany({ where: { id: { in: stylistIds } }, query: "id status isActive" }) : Promise.resolve([])
      ]);
      if (args.clientId && !client || !service || service.status && service.status !== "active") throw new Error("Waitlist client or service is unavailable");
      if (stylists.length !== stylistIds.length || stylists.some((stylist) => stylist.status === "inactive" || stylist.isActive === false)) throw new Error("A preferred stylist is unavailable");
      const duplicate = (await sudo.query.WaitlistEntry.findMany({
        where: args.clientId ? { client: { id: { equals: args.clientId } }, service: { id: { equals: args.serviceId } }, isActive: { equals: true } } : { guestName: { equals: guestName }, guestPhone: { equals: guestPhone }, service: { id: { equals: args.serviceId } }, isActive: { equals: true } },
        take: 1,
        query: "id status"
      }))[0];
      if (duplicate) return { success: true, waitlistEntryId: duplicate.id, status: duplicate.status, error: null };
      const entry = await sudo.query.WaitlistEntry.createOne({
        data: {
          client: args.clientId ? { connect: { id: args.clientId } } : void 0,
          guestName,
          guestPhone,
          service: { connect: { id: args.serviceId } },
          preferredStylists: stylistIds.length ? { connect: stylistIds.map((id) => ({ id })) } : void 0,
          preferredDays,
          preferredTimeRange,
          dateRangeStart: start?.toISOString(),
          dateRangeEnd: end?.toISOString(),
          notes,
          requestKey: args.idempotencyKey,
          status: "active",
          isActive: true
        },
        query: "id status"
      });
      return { success: true, waitlistEntryId: entry.id, status: entry.status, error: null };
    });
  } catch (error) {
    return { ...denied4, error: error instanceof Error ? error.message : "Waitlist request failed" };
  }
}
async function transitionWaitlistEntryTransaction(context, args) {
  if (!operator(context)) return { ...denied4, error: "You must be an authorized salon operator" };
  const targets = { notify: "notified", remove: "removed", reactivate: "active", convert: "converted" };
  if (typeof args.action !== "string" || !Object.hasOwn(targets, args.action)) return { ...denied4, error: "Unsupported waitlist transition" };
  const target = targets[args.action];
  if (!target) return { ...denied4, error: "Unsupported waitlist transition" };
  const reason = args.reason?.trim() || "";
  if (reason.length > 1e3) return { ...denied4, error: "Transition reason is too long" };
  if (args.action === "convert" && !args.appointmentId) return { ...denied4, error: "Converted waitlist entries require an appointment" };
  try {
    return await serializableWorkflow(context, "salon-waitlist", [`entry:${args.waitlistEntryId}`], async (transactionContext) => {
      const current = await freshWaitlistContext(transactionContext);
      const sudo = current.sudo();
      const entry = await sudo.query.WaitlistEntry.findOne({
        where: { id: args.waitlistEntryId },
        query: "id status client { id } service { id } convertedAppointment { id }"
      });
      if (!entry) throw new Error("Waitlist entry not found");
      if (entry.status === target && (target !== "converted" || entry.convertedAppointment?.id === args.appointmentId)) {
        return { success: true, waitlistEntryId: entry.id, status: entry.status, error: null };
      }
      const valid = {
        active: ["notified", "removed"],
        notified: ["active", "converted", "removed"],
        removed: ["active"],
        converted: []
      };
      if (!(valid[entry.status || "active"] || []).includes(target)) throw new Error(`Cannot transition waitlist entry from ${entry.status || "active"} to ${target}`);
      if (target === "converted") {
        const appointment = await sudo.query.Appointment.findOne({
          where: { id: args.appointmentId },
          query: "id client { user { id } } services { id }"
        });
        if (!appointment || appointment.client?.user?.id !== entry.client?.id || !appointment.services.some((service) => service.id === entry.service?.id)) {
          throw new Error("Converted appointment does not match the waitlist entry");
        }
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await sudo.query.WaitlistEntry.updateOne({
        where: { id: entry.id },
        data: {
          status: target,
          isActive: target === "active" || target === "notified",
          notifiedAt: target === "notified" ? now : void 0,
          transitionedAt: now,
          transitionReason: reason,
          convertedAppointment: target === "converted" ? { connect: { id: args.appointmentId } } : void 0
        },
        query: "id"
      });
      return { success: true, waitlistEntryId: entry.id, status: target, error: null };
    });
  } catch (error) {
    return { ...denied4, error: error instanceof Error ? error.message : "Waitlist transition failed" };
  }
}
var resultType6 = import_core72.graphql.object()({
  name: "WaitlistWorkflowResult",
  fields: {
    success: import_core72.graphql.field({ type: import_core72.graphql.nonNull(import_core72.graphql.Boolean) }),
    waitlistEntryId: import_core72.graphql.field({ type: import_core72.graphql.ID }),
    status: import_core72.graphql.field({ type: import_core72.graphql.String }),
    error: import_core72.graphql.field({ type: import_core72.graphql.String })
  }
});
var joinWaitlist = import_core72.graphql.field({
  type: resultType6,
  args: {
    clientId: import_core72.graphql.arg({ type: import_core72.graphql.ID }),
    guestName: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    guestPhone: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    serviceId: import_core72.graphql.arg({ type: import_core72.graphql.nonNull(import_core72.graphql.ID) }),
    preferredStylistIds: import_core72.graphql.arg({ type: import_core72.graphql.list(import_core72.graphql.nonNull(import_core72.graphql.ID)) }),
    preferredDays: import_core72.graphql.arg({ type: import_core72.graphql.JSON }),
    preferredTimeRange: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    dateRangeStart: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    dateRangeEnd: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    notes: import_core72.graphql.arg({ type: import_core72.graphql.String }),
    idempotencyKey: import_core72.graphql.arg({ type: import_core72.graphql.nonNull(import_core72.graphql.String) })
  },
  resolve(_source, args, context) {
    return joinWaitlistTransaction(context, args);
  }
});
var transitionWaitlistEntry = import_core72.graphql.field({
  type: resultType6,
  args: {
    waitlistEntryId: import_core72.graphql.arg({ type: import_core72.graphql.nonNull(import_core72.graphql.ID) }),
    action: import_core72.graphql.arg({ type: import_core72.graphql.nonNull(import_core72.graphql.String) }),
    appointmentId: import_core72.graphql.arg({ type: import_core72.graphql.ID }),
    reason: import_core72.graphql.arg({ type: import_core72.graphql.String })
  },
  resolve(_source, args, context) {
    return transitionWaitlistEntryTransaction(context, args);
  }
});

// features/keystone/mutations/scheduleWorkflows.ts
var import_core73 = require("@keystone-6/core");
var denied5 = { success: false, scheduleId: null, revision: null };
async function canManageStylistSchedule(context, stylistId) {
  if (permissions.canManageSchedules({ session: context.session })) return true;
  if (!permissions.canManageOwnSchedule({ session: context.session }) || !context.session?.itemId) return false;
  const stylist = await context.sudo().query.Stylist.findOne({ where: { id: stylistId }, query: "user { id }" });
  return stylist?.user?.id === context.session.itemId;
}
function dateKey(value, label = "Schedule date") {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} is invalid`);
  const date2 = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date2.getTime()) || date2.toISOString().slice(0, 10) !== value) throw new Error(`${label} is invalid`);
  return value;
}
function timestampForDate(value) {
  return value ? `${value}T12:00:00.000Z` : null;
}
function normalize(input) {
  const type = input.type;
  if (!(/* @__PURE__ */ new Set(["recurring", "one_time", "time_off"])).has(type)) throw new Error("Schedule type is invalid");
  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  if (end <= start) throw new Error("Schedule end time must follow start time");
  const breakStart = input.breakStart?.trim() || "";
  const breakEnd = input.breakEnd?.trim() || "";
  if (breakStart && !breakEnd || !breakStart && breakEnd) throw new Error("Schedule break requires both start and end");
  if (breakStart && breakEnd) {
    const breakStartMinutes = timeToMinutes(breakStart);
    const breakEndMinutes = timeToMinutes(breakEnd);
    if (breakStartMinutes < start || breakEndMinutes > end || breakEndMinutes <= breakStartMinutes) throw new Error("Schedule break must fall within working hours");
  }
  const localDate = dateKey(input.localDate);
  const effectiveFrom = dateKey(input.effectiveFrom, "Effective start date");
  const effectiveTo = dateKey(input.effectiveTo, "Effective end date");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective end date must follow its start date");
  if (type === "recurring" && (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6)) throw new Error("Recurring schedules require a valid day of week");
  if (type !== "recurring" && !localDate) throw new Error("One-time and time-off schedules require a local date");
  if (type === "recurring" && localDate) throw new Error("Recurring schedules cannot have a local date");
  const reason = input.reason?.trim() || "";
  if (reason.length > 1e3) throw new Error("Schedule reason is too long");
  const idempotencyKey = input.idempotencyKey?.trim() || "";
  if (!input.scheduleId && (idempotencyKey.length < 12 || idempotencyKey.length > 200)) throw new Error("A valid idempotency key is required");
  return {
    type,
    dayOfWeek: type === "recurring" ? input.dayOfWeek : null,
    localDate: type === "recurring" ? "" : localDate,
    date: type === "recurring" ? null : timestampForDate(localDate),
    startTime: input.startTime,
    endTime: input.endTime,
    breakStart,
    breakEnd,
    isAvailable: type === "time_off" ? false : input.isAvailable !== false,
    reason,
    effectiveFrom: type === "recurring" ? timestampForDate(effectiveFrom) : null,
    effectiveTo: type === "recurring" ? timestampForDate(effectiveTo) : null,
    idempotencyKey
  };
}
async function upsertStylistScheduleTransaction(context, input) {
  if (!await canManageStylistSchedule(context, input.stylistId)) return { ...denied5, error: "You do not have permission to manage this stylist schedule" };
  let normalized;
  try {
    normalized = normalize(input);
  } catch (error) {
    return { ...denied5, error: error instanceof Error ? error.message : "Schedule input is invalid" };
  }
  try {
    return await serializableWorkflow(context, "salon-schedule", [
      `stylist:${input.stylistId}`,
      `location:${input.locationId}`,
      input.scheduleId ? `schedule:${input.scheduleId}` : `idempotency:${normalized.idempotencyKey}`
    ], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const [stylist, location] = await Promise.all([
        sudo.query.Stylist.findOne({ where: { id: input.stylistId }, query: "id status isActive locations { id }" }),
        sudo.query.Location.findOne({ where: { id: input.locationId }, query: "id isActive" })
      ]);
      if (!stylist || stylist.status === "inactive" || stylist.isActive === false) throw new Error("Stylist is unavailable");
      if (!location || location.isActive === false) throw new Error("Location is unavailable");
      if (!stylist.locations?.some((assigned) => assigned.id === location.id)) throw new Error("Stylist is not assigned to this location");
      if (!input.scheduleId) {
        const existing2 = (await sudo.query.StylistSchedule.findMany({
          where: { idempotencyKey: { equals: normalized.idempotencyKey } },
          take: 1,
          query: "id revision stylist { id } location { id } type dayOfWeek localDate startTime endTime"
        }))[0];
        if (existing2) {
          if (existing2.stylist?.id !== input.stylistId || existing2.location?.id !== input.locationId || existing2.type !== normalized.type || (existing2.dayOfWeek ?? null) !== normalized.dayOfWeek || (existing2.localDate || "") !== normalized.localDate || existing2.startTime !== normalized.startTime || existing2.endTime !== normalized.endTime) {
            throw new Error("Idempotency key was already used for another schedule");
          }
          return { success: true, scheduleId: existing2.id, revision: existing2.revision, error: null };
        }
        const created = await sudo.query.StylistSchedule.createOne({
          data: {
            ...normalized,
            stylist: { connect: { id: input.stylistId } },
            location: { connect: { id: input.locationId } },
            revision: 1
          },
          query: "id revision"
        });
        return { success: true, scheduleId: created.id, revision: created.revision, error: null };
      }
      const existing = await sudo.query.StylistSchedule.findOne({
        where: { id: input.scheduleId },
        query: "id revision idempotencyKey stylist { id } location { id }"
      });
      if (!existing || existing.stylist?.id !== input.stylistId || existing.location?.id !== input.locationId) throw new Error("Schedule not found");
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== existing.revision) throw new Error("Schedule was changed by another operator");
      const revision = existing.revision + 1;
      await sudo.query.StylistSchedule.updateOne({
        where: { id: existing.id },
        data: { ...normalized, idempotencyKey: existing.idempotencyKey, revision },
        query: "id"
      });
      return { success: true, scheduleId: existing.id, revision, error: null };
    });
  } catch (error) {
    return { ...denied5, error: error instanceof Error ? error.message : "Schedule workflow failed" };
  }
}
async function setStylistScheduleAvailabilityTransaction(context, input) {
  const target = await context.sudo().query.StylistSchedule.findOne({ where: { id: input.scheduleId }, query: "stylist { id }" });
  if (!target?.stylist?.id || !await canManageStylistSchedule(context, target.stylist.id)) return { ...denied5, error: "You do not have permission to manage this stylist schedule" };
  const reason = input.reason?.trim() || "";
  if (reason.length > 1e3) return { ...denied5, error: "Schedule reason is too long" };
  try {
    return await serializableWorkflow(context, "salon-schedule", [`schedule:${input.scheduleId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const schedule = await sudo.query.StylistSchedule.findOne({
        where: { id: input.scheduleId },
        query: "id type revision isAvailable reason"
      });
      if (!schedule) throw new Error("Schedule not found");
      if (schedule.type === "time_off" && input.isAvailable) throw new Error("Time-off entries cannot be restored as availability");
      if (schedule.isAvailable === input.isAvailable && (!reason || schedule.reason === reason)) {
        return { success: true, scheduleId: schedule.id, revision: schedule.revision, error: null };
      }
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== schedule.revision) throw new Error("Schedule was changed by another operator");
      const revision = schedule.revision + 1;
      await sudo.query.StylistSchedule.updateOne({
        where: { id: schedule.id },
        data: { isAvailable: input.isAvailable, reason: reason || (input.isAvailable ? "" : "Blocked by operator"), revision },
        query: "id"
      });
      return { success: true, scheduleId: schedule.id, revision, error: null };
    });
  } catch (error) {
    return { ...denied5, error: error instanceof Error ? error.message : "Schedule workflow failed" };
  }
}
var resultType7 = import_core73.graphql.object()({
  name: "StylistScheduleWorkflowResult",
  fields: {
    success: import_core73.graphql.field({ type: import_core73.graphql.nonNull(import_core73.graphql.Boolean) }),
    scheduleId: import_core73.graphql.field({ type: import_core73.graphql.ID }),
    revision: import_core73.graphql.field({ type: import_core73.graphql.Int }),
    error: import_core73.graphql.field({ type: import_core73.graphql.String })
  }
});
var upsertStylistSchedule = import_core73.graphql.field({
  type: resultType7,
  args: {
    scheduleId: import_core73.graphql.arg({ type: import_core73.graphql.ID }),
    stylistId: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.ID) }),
    locationId: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.ID) }),
    type: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.String) }),
    dayOfWeek: import_core73.graphql.arg({ type: import_core73.graphql.Int }),
    localDate: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    startTime: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.String) }),
    endTime: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.String) }),
    breakStart: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    breakEnd: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    isAvailable: import_core73.graphql.arg({ type: import_core73.graphql.Boolean }),
    reason: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    effectiveFrom: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    effectiveTo: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    idempotencyKey: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    expectedRevision: import_core73.graphql.arg({ type: import_core73.graphql.Int })
  },
  resolve(_source, args, context) {
    return upsertStylistScheduleTransaction(context, args);
  }
});
var setStylistScheduleAvailability = import_core73.graphql.field({
  type: resultType7,
  args: {
    scheduleId: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.ID) }),
    isAvailable: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.Boolean) }),
    reason: import_core73.graphql.arg({ type: import_core73.graphql.String }),
    expectedRevision: import_core73.graphql.arg({ type: import_core73.graphql.nonNull(import_core73.graphql.Int) })
  },
  resolve(_source, args, context) {
    return setStylistScheduleAvailabilityTransaction(context, args);
  }
});

// features/keystone/mutations/commissionWorkflows.ts
var import_core74 = require("@keystone-6/core");
var denied6 = { success: false, payoutCount: 0, totalAmount: 0 };
var COMMISSION_RECOVERY_DELAYS_MS = [0, 50, 150];
function originalCommissionPayoutError(error) {
  return error instanceof Error ? error.message : "Commission payout failed";
}
function opaqueCommissionLifecycleError(error) {
  return /Commission\.hooks\.afterOperation: Prisma error/i.test(originalCommissionPayoutError(error));
}
function completedCommissionPayoutReplay(commissions, requestedIds) {
  const requested = new Set(requestedIds);
  const returnedIds = commissions.map((commission) => commission?.id).filter((id) => typeof id === "string");
  const returned = new Set(returnedIds);
  if (requested.size !== requestedIds.length || commissions.length !== requested.size || returned.size !== commissions.length || returnedIds.some((id) => !requested.has(id)) || [...requested].some((id) => !returned.has(id))) return null;
  const stylistIds = new Set(commissions.map((commission) => commission.stylist?.id).filter(Boolean));
  if (stylistIds.size !== 1 || commissions.some((commission) => commission.isPaid !== true || !commission.paidAt || Number.isNaN(new Date(commission.paidAt).getTime()) || !Number.isSafeInteger(commission.commissionAmount))) return null;
  const totalAmount = commissions.reduce((sum, commission) => sum + commission.commissionAmount, 0);
  if (!Number.isSafeInteger(totalAmount)) return null;
  return { success: true, payoutCount: 0, totalAmount, error: null };
}
async function recoverCompletedCommissionPayout(context, requestedIds, delaysMs = COMMISSION_RECOVERY_DELAYS_MS) {
  for (const delayMs of delaysMs.slice(0, COMMISSION_RECOVERY_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const commissions = await context.sudo().query.Commission.findMany({
        where: { id: { in: [...requestedIds] } },
        take: Math.min(requestedIds.length + 1, 201),
        query: "id isPaid paidAt commissionAmount stylist { id }"
      });
      const replay = completedCommissionPayoutReplay(commissions, requestedIds);
      if (replay) return replay;
      const returnedIds = new Set(commissions.map((commission) => commission.id));
      const exactRows = commissions.length === requestedIds.length && returnedIds.size === requestedIds.length && requestedIds.every((id) => returnedIds.has(id));
      if (!exactRows || commissions.some((commission) => !commission.stylist?.id) || new Set(commissions.map((commission) => commission.stylist.id)).size !== 1) return null;
    } catch {
      return null;
    }
  }
  return null;
}
function classifiedCommissionPayoutError(error, recovered) {
  return opaqueCommissionLifecycleError(error) && recovered ? recovered : { ...denied6, error: originalCommissionPayoutError(error) };
}
async function payoutCommissionsTransaction(context, commissionIds) {
  if (!permissions.canManageCommissions({ session: context.session })) {
    return { ...denied6, error: "You must be an authorized salon operator" };
  }
  const ids2 = [...new Set(commissionIds.map((id) => id.trim()).filter(Boolean))];
  if (ids2.length === 0 || ids2.length > 200) {
    return { ...denied6, error: "Choose between 1 and 200 commissions" };
  }
  try {
    return await serializableWorkflow(
      context,
      "salon-commission-payout",
      ids2.map((id) => `commission:${id}`),
      async (transactionContext) => {
        const sudo = transactionContext.sudo();
        const commissions = await sudo.query.Commission.findMany({
          where: { id: { in: ids2 } },
          take: 200,
          query: "id isPaid paidAt commissionAmount stylist { id }"
        });
        if (commissions.length !== ids2.length) throw new Error("One or more commissions were not found");
        const stylistIds = new Set(commissions.map((commission) => commission.stylist?.id).filter(Boolean));
        if (stylistIds.size !== 1) throw new Error("A payout batch must belong to one stylist");
        const paidAt = (/* @__PURE__ */ new Date()).toISOString();
        let payoutCount = 0;
        for (const commission of commissions) {
          if (commission.isPaid) continue;
          await sudo.query.Commission.updateOne({
            where: { id: commission.id },
            data: { isPaid: true, paidAt },
            query: "id"
          });
          payoutCount += 1;
        }
        return {
          success: true,
          payoutCount,
          totalAmount: commissions.reduce((sum, commission) => sum + Number(commission.commissionAmount || 0), 0),
          error: null
        };
      }
    );
  } catch (error) {
    const recovered = opaqueCommissionLifecycleError(error) ? await recoverCompletedCommissionPayout(context, ids2) : null;
    return classifiedCommissionPayoutError(error, recovered);
  }
}
var resultType8 = import_core74.graphql.object()({
  name: "CommissionPayoutResult",
  fields: {
    success: import_core74.graphql.field({ type: import_core74.graphql.nonNull(import_core74.graphql.Boolean) }),
    payoutCount: import_core74.graphql.field({ type: import_core74.graphql.nonNull(import_core74.graphql.Int) }),
    totalAmount: import_core74.graphql.field({ type: import_core74.graphql.nonNull(import_core74.graphql.Int) }),
    error: import_core74.graphql.field({ type: import_core74.graphql.String })
  }
});
var payoutCommissions = import_core74.graphql.field({
  type: resultType8,
  args: {
    commissionIds: import_core74.graphql.arg({ type: import_core74.graphql.nonNull(import_core74.graphql.list(import_core74.graphql.nonNull(import_core74.graphql.ID))) })
  },
  resolve(_source, args, context) {
    return payoutCommissionsTransaction(context, args.commissionIds);
  }
});

// features/keystone/mutations/resourceWorkflows.ts
var import_core75 = require("@keystone-6/core");
var denied7 = { success: false, resourceId: null, revision: null };
var ACTIVE_APPOINTMENT_STATUSES3 = ["pending", "confirmed", "in_progress"];
var ACTIVE_SEGMENT_STATUSES2 = ["planned", "started"];
async function assertResourceHasNoActiveAssignments(sudo, resourceId) {
  const activeAppointments = await sudo.query.Appointment.count({
    where: { resource: { id: { equals: resourceId } }, status: { in: [...ACTIVE_APPOINTMENT_STATUSES3] } }
  });
  if (activeAppointments > 0) throw new Error("Resource has active appointments and cannot be disabled");
  const activeSegments = await sudo.query.AppointmentSegment.findMany({
    where: {
      resource: { id: { equals: resourceId } },
      appointment: { status: { in: [...ACTIVE_APPOINTMENT_STATUSES3] } },
      status: { in: [...ACTIVE_SEGMENT_STATUSES2] }
    },
    take: 1,
    query: "id"
  });
  if (activeSegments.length > 0) throw new Error("Resource has active segment assignments and cannot be disabled");
}
async function setSalonResourceAvailabilityTransaction(context, input) {
  if (!permissions.canManageResources({ session: context.session })) {
    return { ...denied7, error: "You must be an authorized salon operator" };
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    return { ...denied7, error: "A valid resource revision is required" };
  }
  try {
    return await serializableWorkflow(context, "salon-resource", [`resource:${input.resourceId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const resource = await sudo.query.SalonResource.findOne({
        where: { id: input.resourceId },
        query: "id isActive revision location { id isActive }"
      });
      if (!resource) throw new Error("Resource not found");
      if (!resource.location?.id || resource.location.isActive === false) throw new Error("Resource location is unavailable");
      if (resource.isActive === input.isActive) {
        return { success: true, resourceId: resource.id, revision: resource.revision, error: null };
      }
      if (resource.revision !== input.expectedRevision) throw new Error("Resource was changed by another operator");
      if (!input.isActive) await assertResourceHasNoActiveAssignments(sudo, resource.id);
      const revision = resource.revision + 1;
      await sudo.query.SalonResource.updateOne({
        where: { id: resource.id },
        data: { isActive: input.isActive, revision },
        query: "id"
      });
      return { success: true, resourceId: resource.id, revision, error: null };
    });
  } catch (error) {
    return { ...denied7, error: error instanceof Error ? error.message : "Resource update failed" };
  }
}
var resultType9 = import_core75.graphql.object()({
  name: "SalonResourceWorkflowResult",
  fields: {
    success: import_core75.graphql.field({ type: import_core75.graphql.nonNull(import_core75.graphql.Boolean) }),
    resourceId: import_core75.graphql.field({ type: import_core75.graphql.ID }),
    revision: import_core75.graphql.field({ type: import_core75.graphql.Int }),
    error: import_core75.graphql.field({ type: import_core75.graphql.String })
  }
});
var setSalonResourceAvailability = import_core75.graphql.field({
  type: resultType9,
  args: {
    resourceId: import_core75.graphql.arg({ type: import_core75.graphql.nonNull(import_core75.graphql.ID) }),
    isActive: import_core75.graphql.arg({ type: import_core75.graphql.nonNull(import_core75.graphql.Boolean) }),
    expectedRevision: import_core75.graphql.arg({ type: import_core75.graphql.nonNull(import_core75.graphql.Int) })
  },
  resolve(_source, args, context) {
    return setSalonResourceAvailabilityTransaction(context, args);
  }
});

// features/keystone/mutations/segmentSchedulingWorkflows.ts
var import_node_crypto6 = require("node:crypto");
var import_core76 = require("@keystone-6/core");

// features/keystone/scheduling/service-segment-window.ts
function instant(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value);
  return Number.NaN;
}
function isServiceSegmentEffectiveForInterval(definition, segmentStart, segmentEnd) {
  const effectiveFrom = instant(definition.effectiveFrom);
  const effectiveUntil = definition.effectiveUntil == null ? Number.POSITIVE_INFINITY : instant(definition.effectiveUntil);
  const start = segmentStart.getTime();
  const end = segmentEnd.getTime();
  return Number.isFinite(effectiveFrom) && Number.isFinite(start) && Number.isFinite(end) && (Number.isFinite(effectiveUntil) || effectiveUntil === Number.POSITIVE_INFINITY) && effectiveFrom <= start && start < end && end <= effectiveUntil;
}

// features/keystone/mutations/segmentSchedulingWorkflows.ts
var ACTIVE_SEGMENT_STATUSES3 = ["planned", "started"];
function domainQuery(context) {
  return context.sudo().query;
}
function digest(value) {
  return (0, import_node_crypto6.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
function validKey3(value) {
  return value.trim().length >= 12 && value.length <= 200;
}
function assertEffectiveReschedulePolicy(snapshot2) {
  const now = Date.now();
  if (!snapshot2?.version || !snapshot2?.acceptedAt || !Number.isFinite(Date.parse(snapshot2.effectiveFrom)) || !Number.isFinite(Date.parse(snapshot2.rescheduleDeadline))) throw new Error("Online rescheduling requires an accepted effective policy snapshot");
  if (snapshot2.revokedAt) throw new Error("Online rescheduling policy has been revoked; contact the salon");
  if (new Date(snapshot2.effectiveFrom).getTime() > now || snapshot2.effectiveUntil && new Date(snapshot2.effectiveUntil).getTime() <= now) throw new Error("Online rescheduling policy is not currently effective; contact the salon");
  if (!snapshot2.rescheduleDeadline || new Date(snapshot2.rescheduleDeadline).getTime() <= now) throw new Error("Online rescheduling is outside the accepted policy window; contact the salon");
}
function parseAllocations(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("Choose between 1 and 100 schedule segments");
  return value.map((raw, index) => {
    const item = {
      lineItemId: String(raw?.lineItemId || ""),
      definitionId: raw?.definitionId ? String(raw.definitionId) : null,
      stableKey: String(raw?.stableKey || `segment-${index + 1}`),
      sequence: Number(raw?.sequence),
      parallelGroup: raw?.parallelGroup ? String(raw.parallelGroup) : null,
      type: raw?.type,
      startOffsetMinutes: Number(raw?.startOffsetMinutes),
      durationMinutes: Number(raw?.durationMinutes),
      practitionerRequired: raw?.practitionerRequired !== false,
      practitionerId: raw?.practitionerId ? String(raw.practitionerId) : null,
      resourceId: raw?.resourceId ? String(raw.resourceId) : null,
      resourceUnits: Number(raw?.resourceUnits ?? (raw?.resourceId ? 1 : 0))
    };
    if (!item.lineItemId || !item.stableKey || item.stableKey.length > 120) throw new Error("Every segment requires a line item and stable key");
    if (!Number.isInteger(item.sequence) || item.sequence < 0 || !Number.isInteger(item.startOffsetMinutes) || item.startOffsetMinutes < 0 || !Number.isInteger(item.durationMinutes) || item.durationMinutes <= 0 || item.durationMinutes > 24 * 60 || !Number.isInteger(item.resourceUnits) || item.resourceUnits < 0 || item.resourceUnits > 100 || !(/* @__PURE__ */ new Set(["service", "processing", "finishing", "cleanup"])).has(item.type)) throw new Error("Segment timing or type is invalid");
    if (item.practitionerRequired && !item.practitionerId) throw new Error("A required practitioner must be assigned");
    if (item.resourceUnits > 0 && !item.resourceId) throw new Error("Resource units require an assigned resource");
    return item;
  });
}
function allocationsFromAppointment(appointment) {
  return appointment.segments?.length ? appointment.segments.map((segment) => ({
    lineItemId: segment.lineItem.id,
    definitionId: segment.definition?.id || null,
    stableKey: segment.stableKey,
    sequence: segment.sequence,
    parallelGroup: segment.parallelGroup,
    type: segment.type,
    startOffsetMinutes: Math.round((Date.parse(segment.plannedStart) - Date.parse(appointment.startTime)) / 6e4),
    durationMinutes: segment.durationMinutes,
    practitionerRequired: segment.practitionerRequired,
    practitionerId: segment.practitioner?.id || null,
    resourceId: segment.resource?.id || null,
    resourceUnits: segment.resourceUnits
  })) : appointment.lineItems.map((line, index) => ({
    lineItemId: line.id,
    stableKey: `service-${index + 1}`,
    sequence: index,
    type: "service",
    startOffsetMinutes: appointment.lineItems.slice(0, index).reduce((sum, prior) => sum + prior.duration, 0),
    durationMinutes: line.duration,
    practitionerRequired: true,
    practitionerId: appointment.stylist?.id,
    resourceId: appointment.resource?.id,
    resourceUnits: appointment.resource?.id ? 1 : 0
  }));
}
function assignmentLockKeys(items) {
  return items.flatMap((item) => [
    item.practitionerId && `practitioner:${item.practitionerId}`,
    item.resourceId && `resource:${item.resourceId}`
  ]).filter(Boolean);
}
function validateSequence(items) {
  const keys = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (keys.has(item.stableKey)) throw new Error("Segment stable keys must be unique within a revision");
    keys.add(item.stableKey);
  }
  for (const lineItemId of new Set(items.map((item) => item.lineItemId))) {
    const line = items.filter((item) => item.lineItemId === lineItemId).sort((a, b) => a.sequence - b.sequence);
    for (let index = 1; index < line.length; index += 1) {
      const prior = line[index - 1];
      const current = line[index];
      if (current.sequence <= prior.sequence) throw new Error("Segment sequence must be strictly increasing per service line");
      if (current.startOffsetMinutes < prior.startOffsetMinutes + prior.durationMinutes) throw new Error("Segments on one service line cannot overlap");
    }
  }
  for (let left = 0; left < items.length; left += 1) for (let right = left + 1; right < items.length; right += 1) {
    const a = items[left];
    const b = items[right];
    const overlaps = a.startOffsetMinutes < b.startOffsetMinutes + b.durationMinutes && b.startOffsetMinutes < a.startOffsetMinutes + a.durationMinutes;
    if (scheduleIntervalsOverlapWithBuffer(
      a.startOffsetMinutes * 6e4,
      (a.startOffsetMinutes + a.durationMinutes) * 6e4,
      b.startOffsetMinutes * 6e4,
      (b.startOffsetMinutes + b.durationMinutes) * 6e4
    ) && a.practitionerId && a.practitionerId === b.practitionerId) throw new Error("One practitioner cannot be allocated to overlapping or back-to-back segments without a buffer");
    if (overlaps && a.lineItemId !== b.lineItemId && (!a.parallelGroup || a.parallelGroup !== b.parallelGroup)) {
      throw new Error("Parallel service segments must share an explicit parallel group");
    }
    if (overlaps && a.practitionerId && a.practitionerId === b.practitionerId) throw new Error("One practitioner cannot perform parallel segments");
  }
}
async function assertAssignments(sudo, appointment, items, start, location) {
  const appointmentEnd = new Date(start.getTime() + Math.max(...items.map((item) => item.startOffsetMinutes + item.durationMinutes)) * 6e4);
  if (!isLocationOpenForInterval(location.hours, location.timezone, start, appointmentEnd)) throw new Error("Requested appointment is outside salon opening hours");
  const lineMap = new Map(appointment.lineItems.map((line) => [line.id, line]));
  const definitionIds = items.map((item) => item.definitionId).filter(Boolean);
  const definitions2 = definitionIds.length ? await sudo.query.ServiceSegment.findMany({
    where: { id: { in: definitionIds } },
    take: 100,
    query: "id stableKey sequence parallelGroup type durationMinutes practitionerRequired resourceUnits effectiveFrom effectiveUntil service { id } qualifiedPractitioners { id } eligibleResources { id }"
  }) : [];
  const definitionMap = new Map(definitions2.map((item) => [item.id, item]));
  if (appointment.lineItems.some((line) => !items.some((item) => item.lineItemId === line.id))) throw new Error("Every booked service line must be included");
  for (const line of appointment.lineItems) {
    const assignedResourceIds = items.filter((item) => item.lineItemId === line.id).flatMap((item) => item.resourceId ? [item.resourceId] : []);
    if (missingRequiredServiceResourceIds(line.service?.requiredResources || [], assignedResourceIds).length) {
      throw new Error("Every required service resource must be assigned to the booked service plan");
    }
  }
  for (const item of items) {
    const line = lineMap.get(item.lineItemId);
    if (!line) throw new Error("A segment does not belong to this appointment");
    const segmentStart = new Date(start.getTime() + item.startOffsetMinutes * 6e4);
    const segmentEnd = new Date(segmentStart.getTime() + item.durationMinutes * 6e4);
    const definition = item.definitionId ? definitionMap.get(item.definitionId) : null;
    if (item.definitionId && !definition) throw new Error("Segment definition was not found");
    if (definition) {
      if (definition.service?.id !== line.service?.id || definition.stableKey !== item.stableKey || definition.sequence !== item.sequence || definition.type !== item.type || definition.durationMinutes !== item.durationMinutes || definition.practitionerRequired !== item.practitionerRequired || Number(definition.resourceUnits || 0) !== item.resourceUnits) throw new Error("Allocation does not match its effective service-segment version");
      if (!isServiceSegmentEffectiveForInterval(definition, segmentStart, segmentEnd)) throw new Error("Segment definition is not effective for the full scheduled interval");
      if (item.practitionerId && !definition.qualifiedPractitioners.some((person) => person.id === item.practitionerId)) throw new Error("Practitioner is not qualified for this segment");
      if (item.resourceId && !definition.eligibleResources.some((resource) => resource.id === item.resourceId)) throw new Error("Resource is not eligible for this segment");
    } else {
      if (item.type !== "service" || item.durationMinutes !== line.duration || !item.practitionerRequired || items.filter((other) => other.lineItemId === item.lineItemId).length !== 1) throw new Error("Unversioned allocations must preserve the booked service duration and practitioner requirement");
      if (line.service?.requiredResources?.length && !item.resourceId) throw new Error("The booked service requires a resource");
      if (item.practitionerId && !line.service?.specialists?.some((person) => person.id === item.practitionerId)) throw new Error("Practitioner is not qualified for this service");
      if (item.resourceId && !line.service?.requiredResources?.some((resource) => resource.id === item.resourceId)) throw new Error("Resource is not eligible for this service");
    }
    if (item.resourceId) {
      const resource = await sudo.query.SalonResource.findOne({ where: { id: item.resourceId }, query: "id isActive location { id }" });
      if (!resource?.isActive || resource.location?.id !== location.locationId) throw new Error("Resource is not available at the appointment location");
    }
    if (item.practitionerId) {
      const availability = await computeStylistAvailability({ sudo, stylistId: item.practitionerId, date: zonedDateKey(segmentStart, location.timezone), serviceDuration: item.durationMinutes, serviceIds: [line.service.id], locationId: location.locationId, excludeAppointmentId: appointment.id, slotStepMinutes: 1 });
      if (!availability.slots.some((slot) => slot.available && Date.parse(slot.startTime) === segmentStart.getTime())) throw new Error("Requested segment is outside available hours or capacity");
    }
  }
}
async function assertCapacity(sudo, appointmentId, locationId, start, items) {
  for (const item of items) {
    const plannedStart = new Date(start.getTime() + item.startOffsetMinutes * 6e4);
    const plannedEnd = new Date(plannedStart.getTime() + item.durationMinutes * 6e4);
    const overlaps = item.practitionerId ? await sudo.query.AppointmentSegment.findMany({
      where: {
        NOT: { appointment: { id: { equals: appointmentId } } },
        appointment: { status: { in: ["pending", "confirmed", "in_progress"] } },
        status: { in: ACTIVE_SEGMENT_STATUSES3 },
        plannedStart: { lt: new Date(plannedEnd.getTime() + BOOKING_BUFFER_MINUTES * 6e4).toISOString() },
        plannedEnd: { gt: new Date(plannedStart.getTime() - BOOKING_BUFFER_MINUTES * 6e4).toISOString() },
        practitioner: { id: { equals: item.practitionerId } }
      },
      take: 200,
      query: "id practitioner { id }"
    }) : [];
    if (item.practitionerId && overlaps.some((segment) => segment.practitioner?.id === item.practitionerId)) throw new Error("Assigned practitioner is already allocated during this segment");
    if (item.resourceId) {
      const requestedParallelUnits = items.filter((other) => other !== item && other.resourceId === item.resourceId && scheduleIntervalsOverlapWithBuffer(
        item.startOffsetMinutes * 6e4,
        (item.startOffsetMinutes + item.durationMinutes) * 6e4,
        other.startOffsetMinutes * 6e4,
        (other.startOffsetMinutes + other.durationMinutes) * 6e4
      )).reduce((sum, other) => sum + other.resourceUnits, 0);
      const available = await isResourceAllocationAvailable(sudo, {
        resourceId: item.resourceId,
        locationId,
        start: plannedStart,
        end: plannedEnd,
        requestedUnits: item.resourceUnits + requestedParallelUnits,
        excludeAppointmentId: appointmentId
      });
      if (!available) throw new Error("Assigned resource capacity is unavailable during this segment");
    }
  }
}
async function scheduleAppointmentSegmentsTransaction(context, args) {
  if (!context.session?.itemId) return { success: false, appointmentId: null, revision: null, error: "You must be signed in" };
  if (!validKey3(args.idempotencyKey)) return { success: false, appointmentId: null, revision: null, error: "Schedule idempotency key is invalid" };
  const operator2 = permissions.canManageAppointments({ session: context.session });
  let items = [];
  const start = new Date(args.startTime);
  const reason = args.reason.trim();
  try {
    if (operator2 && args.allocations != null) {
      items = parseAllocations(args.allocations);
      validateSequence(items);
    }
  } catch (error) {
    return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Schedule is invalid" };
  }
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now() || start.getTime() > Date.now() + 366 * 864e5 || !reason || reason.length > 1e3) return { success: false, appointmentId: null, revision: null, error: "A valid start and reason are required" };
  let requestedScheduleHash = digest(items);
  let ownerPlanSnapshotHash = null;
  let ownerPlanLockKeys = [];
  if (!operator2 || args.allocations == null) {
    try {
      const ownerSnapshot = await context.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id startTime client { user { id } } stylist { id } resource { id } lineItems { id duration } segments(where: { status: { in: [planned, started] } }) { lineItem { id } definition { id } stableKey sequence parallelGroup type plannedStart durationMinutes practitionerRequired practitioner { id } resource { id } resourceUnits }"
      });
      if (ownerSnapshot && (operator2 || ownerSnapshot.client?.user?.id === context.session.itemId)) {
        const ownerItems = parseAllocations(allocationsFromAppointment(ownerSnapshot));
        validateSequence(ownerItems);
        ownerPlanSnapshotHash = digest(ownerItems);
        ownerPlanLockKeys = assignmentLockKeys(ownerItems);
        if (operator2) {
          items = ownerItems;
          requestedScheduleHash = digest(items);
        }
      }
    } catch (error) {
      return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Appointment plan could not be verified" };
    }
  }
  try {
    return await serializableWorkflow(context, "salon-segment-schedule", [
      `appointment:${args.appointmentId}`,
      `idempotency:${args.idempotencyKey}`,
      ...assignmentLockKeys(items),
      ...ownerPlanLockKeys
    ], async (transactionContext) => {
      const visible = await transactionContext.query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id client { user { id } }" });
      if (!visible || !operator2 && visible.client?.user?.id !== context.session.itemId) throw new Error("You cannot schedule this appointment");
      const sudo = transactionContext.sudo();
      const domain3 = domainQuery(transactionContext);
      const existing = (await domain3.AppointmentScheduleRevision.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id revision nextStart reason scheduleHash appointment { id }" }))[0];
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status startTime endTime metadata location { id } stylist { id } resource { id } client { user { id } } lineItems { id duration service { id specialists { id } requiredResources { id } } } segments(where: { status: { in: [planned, started] } }) { lineItem { id } definition { id } stableKey sequence parallelGroup type plannedStart durationMinutes practitionerRequired practitioner { id } resource { id } resourceUnits }"
      });
      if (!appointment || ["completed", "cancelled", "no_show"].includes(appointment.status || "")) throw new Error("Appointment is not schedulable");
      const owner = appointment.client?.user?.id === context.session.itemId;
      if (!operator2 && !owner) throw new Error("You cannot schedule this appointment");
      if (!operator2 || args.allocations == null) {
        const metadata2 = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata : {};
        if (!operator2) assertEffectiveReschedulePolicy(metadata2.clientPolicySnapshot);
        items = parseAllocations(allocationsFromAppointment(appointment));
        validateSequence(items);
        requestedScheduleHash = digest(items);
        if (!ownerPlanSnapshotHash || requestedScheduleHash !== ownerPlanSnapshotHash) throw new Error("The appointment plan changed; reload before rescheduling");
      }
      if (existing) {
        if (existing.appointment?.id !== args.appointmentId || new Date(existing.nextStart).getTime() !== start.getTime() || existing.reason !== reason || existing.scheduleHash !== requestedScheduleHash) throw new Error("Schedule idempotency key was reused for different evidence");
        return { success: true, appointmentId: args.appointmentId, revision: existing.revision, error: null };
      }
      const location = await getRuntimeLocation(sudo, appointment.location?.id);
      await assertAssignments(sudo, appointment, items, start, location);
      await assertCapacity(sudo, appointment.id, location.locationId, start, items);
      const previous = await domain3.AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ACTIVE_SEGMENT_STATUSES3 } }, take: 200, query: "id status" });
      const revisions = await domain3.AppointmentScheduleRevision.findMany({ where: { appointment: { id: { equals: appointment.id } } }, take: 200, query: "id revision" });
      const revisionNumber = Math.max(0, ...revisions.map((item) => Number(item.revision || 0))) + 1;
      const endOffset = Math.max(...items.map((item) => item.startOffsetMinutes + item.durationMinutes));
      const end = new Date(start.getTime() + endOffset * 6e4);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const scheduleHash = requestedScheduleHash;
      const revision = await domain3.AppointmentScheduleRevision.createOne({ data: {
        appointment: { connect: { id: appointment.id } },
        revision: revisionNumber,
        priorStart: appointment.startTime || void 0,
        priorEnd: appointment.endTime || void 0,
        nextStart: start.toISOString(),
        nextEnd: end.toISOString(),
        reason,
        actor: { connect: { id: context.session.itemId } },
        actorAuthority: operator2 ? "appointment_operator" : "client_owner",
        scheduleHash,
        idempotencyKey: args.idempotencyKey,
        evidence: { segmentCount: items.length, priorActiveSegmentIds: previous.map((item) => item.id) }
      }, query: "id" });
      for (const segment of previous) {
        await domain3.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "superseded" }, query: "id" });
        await domain3.SegmentTransition.createOne({ data: { segment: { connect: { id: segment.id } }, fromStatus: segment.status, toStatus: "superseded", reason, actor: { connect: { id: context.session.itemId } }, occurredAt: now, idempotencyKey: `${args.idempotencyKey}:supersede:${segment.id}`, evidence: { scheduleRevision: revisionNumber } }, query: "id" });
      }
      for (const item of items) {
        const plannedStart = new Date(start.getTime() + item.startOffsetMinutes * 6e4);
        const plannedEnd = new Date(plannedStart.getTime() + item.durationMinutes * 6e4);
        await domain3.AppointmentSegment.createOne({ data: {
          appointment: { connect: { id: appointment.id } },
          lineItem: { connect: { id: item.lineItemId } },
          definition: item.definitionId ? { connect: { id: item.definitionId } } : void 0,
          revision: { connect: { id: revision.id } },
          stableKey: item.stableKey,
          sequence: item.sequence,
          parallelGroup: item.parallelGroup || "",
          type: item.type,
          plannedStart: plannedStart.toISOString(),
          plannedEnd: plannedEnd.toISOString(),
          durationMinutes: item.durationMinutes,
          practitionerRequired: item.practitionerRequired,
          practitioner: item.practitionerId ? { connect: { id: item.practitionerId } } : void 0,
          resource: item.resourceId ? { connect: { id: item.resourceId } } : void 0,
          resourceUnits: item.resourceUnits,
          status: "planned",
          idempotencyKey: `${args.idempotencyKey}:segment:${item.stableKey}`,
          assignmentEvidence: { definitionId: item.definitionId || null, scheduleHash, qualifiedAt: now }
        }, query: "id" });
      }
      const metadata = appointment.metadata;
      const policy = metadata?.clientPolicySnapshot;
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data: {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration: endOffset,
        stylist: items[0]?.practitionerId ? { connect: { id: items[0].practitionerId } } : { disconnect: true },
        resource: items[0]?.resourceId ? { connect: { id: items[0].resourceId } } : { disconnect: true },
        ...policy?.acceptedAt ? { metadata: { ...metadata, clientPolicySnapshot: { ...policy, cancellationDeadline: new Date(start.getTime() - Number(policy.cancellationNoticeMinutes) * 6e4).toISOString(), rescheduleDeadline: new Date(start.getTime() - Number(policy.rescheduleNoticeMinutes) * 6e4).toISOString() } } } : {}
      }, query: "id" });
      return { success: true, appointmentId: appointment.id, revision: revisionNumber, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Scheduling failed" };
  }
}
var resultType10 = import_core76.graphql.object()({ name: "SegmentScheduleResult", fields: {
  success: import_core76.graphql.field({ type: import_core76.graphql.nonNull(import_core76.graphql.Boolean) }),
  appointmentId: import_core76.graphql.field({ type: import_core76.graphql.ID }),
  revision: import_core76.graphql.field({ type: import_core76.graphql.Int }),
  error: import_core76.graphql.field({ type: import_core76.graphql.String })
} });
var scheduleAppointmentSegments = import_core76.graphql.field({
  type: resultType10,
  args: { appointmentId: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.ID) }), startTime: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }), allocations: import_core76.graphql.arg({ type: import_core76.graphql.JSON }), reason: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }), idempotencyKey: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }) },
  resolve(_source, args, context) {
    return scheduleAppointmentSegmentsTransaction(context, args);
  }
});
async function transitionAppointmentSegmentTransaction(context, args) {
  if (!permissions.canManageAppointments({ session: context.session }) || !validKey3(args.idempotencyKey)) return { success: false, appointmentId: null, revision: null, error: "Appointment authority and a valid idempotency key are required" };
  const transitions3 = { planned: ["started", "skipped"], started: ["completed", "skipped"] };
  try {
    return await serializableWorkflow(context, "salon-segment-transition", [`segment:${args.segmentId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
      const domain3 = domainQuery(tx);
      const existing = (await domain3.SegmentTransition.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id toStatus reason segment { id appointment { id } }" }))[0];
      if (existing) {
        if (existing.segment?.id !== args.segmentId || existing.toStatus !== args.status || existing.reason !== args.reason.trim()) throw new Error("Segment transition idempotency key was reused for another transition");
        return { success: true, appointmentId: existing.segment?.appointment?.id || null, revision: null, error: null };
      }
      const segment = await domain3.AppointmentSegment.findOne({ where: { id: args.segmentId }, query: "id status appointment { id }" });
      if (!segment || !(transitions3[segment.status] || []).includes(args.status)) throw new Error("Invalid segment transition");
      await domain3.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: args.status }, query: "id" });
      await domain3.SegmentTransition.createOne({ data: { segment: { connect: { id: segment.id } }, fromStatus: segment.status, toStatus: args.status, reason: args.reason.trim(), actor: { connect: { id: context.session.itemId } }, occurredAt: (/* @__PURE__ */ new Date()).toISOString(), idempotencyKey: args.idempotencyKey, evidence: { controlledWorkflow: true } }, query: "id" });
      return { success: true, appointmentId: segment.appointment?.id || null, revision: null, error: null };
    });
  } catch (error) {
    return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Segment transition failed" };
  }
}
var transitionAppointmentSegment = import_core76.graphql.field({
  type: resultType10,
  args: { segmentId: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.ID) }), status: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }), reason: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }), idempotencyKey: import_core76.graphql.arg({ type: import_core76.graphql.nonNull(import_core76.graphql.String) }) },
  resolve(_source, args, context) {
    return transitionAppointmentSegmentTransaction(context, args);
  }
});

// features/keystone/mutations/reversalWorkflows.ts
var import_node_crypto7 = require("node:crypto");
var import_core77 = require("@keystone-6/core");
var denied8 = { success: false, reversalId: null, paymentDelta: null };
function domain(context) {
  return context.sudo().query;
}
function validKey4(value) {
  return value.trim().length >= 12 && value.length <= 200;
}
function fingerprint(value) {
  return (0, import_node_crypto7.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
function parseLines(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("Choose between 1 and 100 sale lines");
  const ids2 = /* @__PURE__ */ new Set();
  return value.map((raw) => {
    const item = { lineItemId: String(raw?.lineItemId || ""), quantity: Number(raw?.quantity), inventoryDisposition: raw?.inventoryDisposition || "not_applicable" };
    if (!item.lineItemId || ids2.has(item.lineItemId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !(/* @__PURE__ */ new Set(["not_applicable", "return_to_stock", "damaged", "consumed"])).has(item.inventoryDisposition)) throw new Error("Reversal line input is invalid");
    ids2.add(item.lineItemId);
    return item;
  });
}
async function reverseSalonTransactionTransaction(context, args) {
  if (!permissions.canIssueRefunds({ session: context.session })) return { ...denied8, error: "You must have refund authority" };
  if (!validKey4(args.idempotencyKey)) return { ...denied8, error: "Reversal idempotency key is invalid" };
  const reason = args.reason.trim();
  let requested;
  try {
    requested = parseLines(args.lines);
  } catch (error) {
    return { ...denied8, error: error instanceof Error ? error.message : "Reversal input is invalid" };
  }
  if (!reason || reason.length > 1e3 || !Number.isInteger(args.tipCents) || args.tipCents < 0 || !Number.isInteger(args.restorePackageCents) || args.restorePackageCents < 0 || !(/* @__PURE__ */ new Set(["void", "refund", "partial_refund"])).has(args.type)) return { ...denied8, error: "Reversal amounts, type, or reason are invalid" };
  const requestHash = fingerprint({ transactionId: args.transactionId, type: args.type, requested, tipCents: args.tipCents, restorePackageCents: args.restorePackageCents, reason });
  try {
    const execute = async (phase) => serializableWorkflow(context, "salon-sale-reversal", [
      `transaction:${args.transactionId}`,
      `idempotency:${args.idempotencyKey}`,
      ...requested.map((item) => `line:${item.lineItemId}`)
    ], async (tx) => {
      const current = await currentStockContext(tx, "return");
      registerStockTransaction(current);
      await acquireStockLedgerFences(current);
      const sudo = current.sudo();
      const query = domain(current);
      const existing = (await query.TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id paymentDelta conservationEvidence transaction { id }" }))[0];
      if (existing) {
        if (existing.transaction?.id !== args.transactionId || existing.conservationEvidence?.requestHash !== requestHash) throw new Error("Idempotency key was reused for different reversal evidence");
        return { success: true, reversalId: existing.id, paymentDelta: existing.paymentDelta, error: null };
      }
      const transaction = await sudo.query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: `
        id status metadata completedAt location { id } client { id lifetimeValue }
        appointment { id payment { id status subtotal tax tip totalAmount refundedAmount session { id idempotencyKey providerReference provider { id code adapter config isInstalled } } }
          client { id } lineItems: lineItems { id } }
        lineItems { id itemType quantity unitPrice discount commissionRate service { id } product { id } staff { id } }
      ` });
      if (!transaction || transaction.status !== "completed" || !transaction.appointment?.payment) throw new Error("Only a completed controlled sale can be reversed");
      const payment = transaction.appointment.payment;
      if (!payment.session?.provider || !payment.session.providerReference) throw new Error("Payment provider evidence is unavailable");
      const sourceLines = new Map(transaction.lineItems.map((line) => [line.id, line]));
      const priorLines = await query.TransactionReversalLine.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1e3, query: "quantity subtotalDelta taxDelta sourceLine { id }" });
      const calculated = [];
      const originalNet = transaction.lineItems.reduce((sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0) - Number(line.discount || 0), 0);
      const priorSubtotal = priorLines.reduce((sum, line) => sum + Math.abs(Number(line.subtotalDelta || 0)), 0);
      const remainingNet = originalNet - priorSubtotal;
      for (const item of requested) {
        const source = sourceLines.get(item.lineItemId);
        if (!source) throw new Error("A reversal line does not belong to this transaction");
        const previous = priorLines.filter((line) => line.sourceLine?.id === source.id);
        const reversedQuantity = previous.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
        const reversedCents = previous.reduce((sum, line) => sum + Math.abs(Number(line.subtotalDelta || 0)), 0);
        const remainingQuantity = Number(source.quantity || 0) - reversedQuantity;
        const sourceNet = Number(source.unitPrice || 0) * Number(source.quantity || 0) - Number(source.discount || 0);
        if (item.quantity > remainingQuantity) throw new Error("Reversal quantity exceeds the unreversed sale quantity");
        if (source.itemType === "product" && item.inventoryDisposition === "not_applicable") throw new Error("Retail reversals require an inventory disposition");
        if (source.itemType !== "product" && item.inventoryDisposition !== "not_applicable") throw new Error("Inventory disposition applies only to retail lines");
        const subtotalCents = item.quantity === remainingQuantity ? sourceNet - reversedCents : Math.floor(sourceNet * item.quantity / Number(source.quantity || 1));
        calculated.push({ ...item, source, subtotalCents, taxCents: 0 });
      }
      const requestedSubtotal = calculated.reduce((sum, line) => sum + line.subtotalCents, 0);
      if (requestedSubtotal <= 0 || requestedSubtotal > remainingNet) throw new Error("Reversal subtotal does not conserve the source sale");
      const priorReversals = await query.TransactionReversal.findMany({ where: { transaction: { id: { equals: transaction.id } } }, take: 1e3, query: "taxDelta tipDelta paymentDelta commissionDelta" });
      const remainingTax = Number(payment.tax || 0) - priorReversals.reduce((sum, item) => sum + Math.abs(Number(item.taxDelta || 0)), 0);
      const remainingTip = Number(payment.tip || 0) - priorReversals.reduce((sum, item) => sum + Math.abs(Number(item.tipDelta || 0)), 0);
      if (args.tipCents > remainingTip) throw new Error("Tip recovery exceeds the unreversed gratuity");
      let requestedTax = requestedSubtotal === remainingNet ? remainingTax : Math.min(remainingTax, Math.floor(Number(payment.tax || 0) * requestedSubtotal / Math.max(1, originalNet)));
      let assignedTax = 0;
      calculated.forEach((line, index) => {
        line.taxCents = index === calculated.length - 1 ? requestedTax - assignedTax : Math.floor(requestedTax * line.subtotalCents / requestedSubtotal);
        assignedTax += line.taxCents;
      });
      const fullCommercialReversal = requestedSubtotal === remainingNet && requestedTax === remainingTax && args.tipCents === remainingTip;
      if ((args.type === "void" || args.type === "refund") && !fullCommercialReversal) throw new Error("Void and refund require the full remaining sale; use partial_refund for line-level recovery");
      if (args.type === "partial_refund" && fullCommercialReversal) throw new Error("Use refund or void for a full remaining sale reversal");
      const refundCents = requestedSubtotal + requestedTax + args.tipCents;
      const remainingPayment = Number(payment.totalAmount || 0) - Number(payment.refundedAmount || 0);
      const checkoutRefundCents = Math.min(refundCents, remainingPayment);
      const depositRefundCents = refundCents - checkoutRefundCents;
      const checkoutMetadata = transaction.metadata && typeof transaction.metadata === "object" ? transaction.metadata : {};
      const priorDepositAdjustments = await query.DepositAdjustment.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1e3, query: "amountDelta" });
      const remainingDeposit = Number(checkoutMetadata.depositCredit || 0) - priorDepositAdjustments.reduce((sum, item) => sum + Math.abs(Number(item.amountDelta || 0)), 0);
      if (refundCents <= 0 || depositRefundCents > remainingDeposit) throw new Error("Payment reversal does not conserve captured checkout and deposit cents");
      const appointmentSessions = depositRefundCents > 0 ? await sudo.query.PaymentSession.findMany({
        where: { appointment: { id: { equals: transaction.appointment.id } } },
        take: 50,
        query: "id status data providerReference idempotencyKey provider { id code adapter config isInstalled } payment { id status totalAmount refundedAmount }"
      }) : [];
      const depositSession = appointmentSessions.find((session) => session.id !== payment.session.id && session.data?.purpose === "appointment_deposit");
      if (depositRefundCents > 0 && (!depositSession?.provider || !depositSession.providerReference || !depositSession.payment)) throw new Error("Applied deposit payment evidence is unavailable");
      const providers = [
        ...checkoutRefundCents > 0 ? [{ suffix: "checkout", provider: payment.session.provider, providerReference: payment.session.providerReference, amount: checkoutRefundCents }] : [],
        ...depositRefundCents > 0 ? [{ suffix: "deposit", provider: depositSession.provider, providerReference: depositSession.providerReference, amount: depositRefundCents }] : []
      ];
      if (args.restorePackageCents > 0) {
        const usage = (await sudo.query.ClientPackageUsage.findMany({ where: { appointment: { id: { equals: transaction.appointment.id } } }, take: 1, query: "id valueUsed clientPackage { id usedValue }" }))[0];
        const adjustments = await query.ClientPackageAdjustment.findMany({ where: { reversal: { transaction: { id: { equals: transaction.id } } } }, take: 1e3, query: "valueDelta" });
        const priorRestored = adjustments.reduce((sum, item) => sum + Math.max(0, -Number(item.valueDelta || 0)), 0);
        if (!usage?.clientPackage || args.restorePackageCents > requestedSubtotal || args.restorePackageCents + priorRestored > Number(checkoutMetadata.packageCredit || 0) || args.restorePackageCents + priorRestored > Number(usage.valueUsed || 0) || args.restorePackageCents > Number(usage.clientPackage.usedValue || 0)) throw new Error("Package restoration exceeds the remaining source usage");
      }
      if (args.tipCents > 0) {
        const tips = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "amountDelta" });
        if (tips.reduce((sum, item) => sum + Number(item.amountDelta || 0), 0) < args.tipCents) throw new Error("Tip recovery exceeds the conserved gratuity ledger");
      }
      for (const line of calculated) {
        if (line.inventoryDisposition !== "return_to_stock") continue;
        await assertStockLocation(current, transaction.location.id, "return");
        const product = await sudo.query.Product.findOne({ where: { id: line.source.product.id }, query: "id quantity isActive" });
        const balance = await current.prisma.inventoryMovement.aggregate({ where: { productId: line.source.product.id }, _sum: { delta: true } });
        if (!product?.isActive || product.quantity !== (balance._sum.delta ?? 0) || product.quantity + line.quantity > 2147483647) throw new Error("Return stock requires reconciliation before refund");
      }
      const providerHash = fingerprint(providers);
      const pending = checkoutMetadata.pendingSaleReversal;
      if (pending && (pending.key !== args.idempotencyKey || pending.requestHash !== requestHash)) throw new Error("An earlier sale reversal requires reconciliation with its original key");
      if (pending && pending.providerHash !== providerHash) throw new Error("Reserved refund provider or amount changed; reconciliation required");
      if (phase === "prepare") {
        const operation = pending || { key: args.idempotencyKey, requestHash, providerHash, createdAt: (/* @__PURE__ */ new Date()).toISOString(), results: {} };
        if (!pending) await sudo.query.SalonTransaction.updateOne({ where: { id: transaction.id }, data: { metadata: { ...checkoutMetadata, pendingSaleReversal: operation } }, query: "id" });
        return { prepared: true, providers, operation };
      }
      if (!pending) throw new Error("Durable refund reservation is missing");
      const providerResults = providers.map((step) => pending.results?.[step.suffix]);
      if (providerResults.some((result2, index) => !result2 || !["refunded", "completed"].includes(result2.status) || result2.amount !== providers[index].amount)) throw new Error("Provider refund is not verified; reconcile the original operation");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const fullyRefunded = checkoutRefundCents === remainingPayment;
      const commissions = await sudo.query.Commission.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "id saleAmount commissionAmount isPaid stylist { id } service { id } adjustments { amountDelta }" });
      let commissionDelta = 0;
      const commissionPlans = [];
      for (const line of calculated) {
        if (line.source.itemType !== "service") continue;
        const commission = commissions.find((item) => item.service?.id === line.source.service?.id && item.stylist?.id === line.source.staff?.id);
        if (!commission) continue;
        const priorAdjustment = commission.adjustments.reduce((sum, item) => sum + Number(item.amountDelta || 0), 0);
        const remainingCommission = Math.max(0, Number(commission.commissionAmount || 0) + priorAdjustment);
        const amount = Math.min(remainingCommission, Math.round(Number(commission.commissionAmount || 0) * line.subtotalCents / Math.max(1, Number(commission.saleAmount || 0))));
        if (amount > 0) {
          commissionDelta -= amount;
          commissionPlans.push({ commission, amount, sourceLineId: line.source.id });
        }
      }
      const reversal = await query.TransactionReversal.createOne({ data: {
        transaction: { connect: { id: transaction.id } },
        payment: { connect: { id: payment.id } },
        type: args.type,
        status: providerResults.every((result2) => result2.status === "completed" || result2.status === "refunded") ? "posted" : "provider_pending",
        subtotalDelta: -requestedSubtotal,
        taxDelta: -requestedTax,
        tipDelta: -args.tipCents,
        paymentDelta: -refundCents,
        commissionDelta,
        reason,
        actor: { connect: { id: context.session.itemId } },
        providerReference: providerResults.map((result2) => typeof result2.data?.refundId === "string" ? result2.data.refundId : result2.providerReference || "").join(","),
        idempotencyKey: args.idempotencyKey,
        postedAt: now,
        conservationEvidence: { requestHash, originalNet, priorSubtotal, remainingNet, paymentTotal: payment.totalAmount, priorRefunded: payment.refundedAmount, refundCents, checkoutRefundCents, depositRefundCents, remainingDeposit, remainingTax, remainingTip }
      }, query: "id" });
      for (const line of calculated) {
        let movementId = null;
        if (line.source.itemType === "product" && line.inventoryDisposition === "return_to_stock") {
          const movement = await recordInventoryMovement(current, {
            productId: line.source.product.id,
            locationId: transaction.location.id,
            appointmentId: transaction.appointment.id,
            type: "return",
            delta: line.quantity,
            reason: `Sale reversal ${reversal.id}: ${reason}`,
            idempotencyKey: `${args.idempotencyKey}:inventory:${line.source.id}`,
            metadata: { reversalId: reversal.id, sourceLineId: line.source.id }
          });
          if (!movement.success) throw new Error(movement.error || "Inventory reversal failed");
          movementId = movement.movementId;
        }
        const lineCommission = commissionPlans.filter((plan) => plan.sourceLineId === line.source.id).reduce((sum, plan) => sum + plan.amount, 0);
        await query.TransactionReversalLine.createOne({ data: {
          reversal: { connect: { id: reversal.id } },
          sourceLine: { connect: { id: line.source.id } },
          quantity: line.quantity,
          subtotalDelta: -line.subtotalCents,
          taxDelta: -line.taxCents,
          commissionDelta: -lineCommission,
          inventoryDisposition: line.inventoryDisposition,
          inventoryMovement: movementId ? { connect: { id: movementId } } : void 0,
          idempotencyKey: `${args.idempotencyKey}:line:${line.source.id}`,
          evidence: { sourceQuantity: line.source.quantity, sourceUnitPrice: line.source.unitPrice, sourceDiscount: line.source.discount }
        }, query: "id" });
      }
      for (const plan of commissionPlans) await query.CommissionAdjustment.createOne({ data: {
        commission: { connect: { id: plan.commission.id } },
        reversal: { connect: { id: reversal.id } },
        amountDelta: -plan.amount,
        payablePeriod: plan.commission.isPaid ? "next_open_period_recovery" : "current_open_period",
        reason,
        actor: { connect: { id: context.session.itemId } },
        postedAt: now,
        idempotencyKey: `${args.idempotencyKey}:commission:${plan.commission.id}`,
        evidence: { paidSourceCommission: plan.commission.isPaid, sourceLineId: plan.sourceLineId }
      }, query: "id" });
      if (args.tipCents > 0) {
        const allocations = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: payment.id } } }, take: 200, query: "id amountDelta practitioner { id }" });
        const positive = allocations.filter((entry) => Number(entry.amountDelta) > 0);
        let assigned = 0;
        for (let index = 0; index < positive.length; index += 1) {
          const allocation = positive[index];
          const amount = index === positive.length - 1 ? args.tipCents - assigned : Math.floor(args.tipCents * Number(allocation.amountDelta) / Math.max(1, Number(payment.tip)));
          assigned += amount;
          if (amount <= 0) continue;
          await query.GratuityLedgerEntry.createOne({ data: {
            payment: { connect: { id: payment.id } },
            reversal: { connect: { id: reversal.id } },
            practitioner: allocation.practitioner?.id ? { connect: { id: allocation.practitioner.id } } : void 0,
            type: "recovery",
            amountDelta: -amount,
            payoutStatus: "recovery_due",
            reason,
            actor: { connect: { id: context.session.itemId } },
            postedAt: now,
            idempotencyKey: `${args.idempotencyKey}:tip:${allocation.id}`,
            evidence: { sourceAllocationId: allocation.id }
          }, query: "id" });
        }
        if (assigned !== args.tipCents) throw new Error("Tip recovery cannot be allocated without conserved source gratuity entries");
      }
      if (depositRefundCents > 0) {
        const depositRefunded = Number(depositSession.payment.refundedAmount || 0) + depositRefundCents;
        await sudo.query.Payment.updateOne({ where: { id: depositSession.payment.id }, data: { refundedAmount: depositRefunded, status: depositRefunded >= Number(depositSession.payment.totalAmount || 0) ? "refunded" : "partially_refunded", refundedAt: now, refundReason: reason }, query: "id" });
        await query.DepositAdjustment.createOne({ data: {
          reversal: { connect: { id: reversal.id } },
          paymentSession: { connect: { id: depositSession.id } },
          amountDelta: -depositRefundCents,
          reason,
          actor: { connect: { id: context.session.itemId } },
          postedAt: now,
          idempotencyKey: `${args.idempotencyKey}:deposit`,
          evidence: { appliedDepositCredit: checkoutMetadata.depositCredit, priorDepositAdjustments: remainingDeposit - Number(checkoutMetadata.depositCredit || 0) }
        }, query: "id" });
      }
      if (args.restorePackageCents > 0) {
        if (args.restorePackageCents > requestedSubtotal || args.restorePackageCents > Number(checkoutMetadata.packageCredit || 0)) throw new Error("Package restoration exceeds the reversed package-funded value");
        const usage = (await sudo.query.ClientPackageUsage.findMany({ where: { appointment: { id: { equals: transaction.appointment.id } } }, take: 1, query: "id valueUsed clientPackage { id usedValue totalValue }" }))[0];
        if (!usage?.clientPackage || args.restorePackageCents > Number(usage.valueUsed || 0)) throw new Error("Package usage evidence is unavailable");
        const nextUsed = Math.max(0, Number(usage.clientPackage.usedValue || 0) - args.restorePackageCents);
        await sudo.query.ClientPackage.updateOne({ where: { id: usage.clientPackage.id }, data: { usedValue: nextUsed, status: "active" }, query: "id" });
        await query.ClientPackageAdjustment.createOne({ data: {
          clientPackage: { connect: { id: usage.clientPackage.id } },
          reversal: { connect: { id: reversal.id } },
          valueDelta: -args.restorePackageCents,
          reason,
          actor: { connect: { id: context.session.itemId } },
          postedAt: now,
          idempotencyKey: `${args.idempotencyKey}:package`,
          evidence: { sourceUsageId: usage.id }
        }, query: "id" });
      }
      const cumulativeRefund = Number(payment.refundedAmount || 0) + checkoutRefundCents;
      await sudo.query.Payment.updateOne({ where: { id: payment.id }, data: { refundedAmount: cumulativeRefund, status: fullyRefunded ? "refunded" : "partially_refunded", refundedAt: now, refundReason: reason }, query: "id" });
      if (transaction.client?.id) await sudo.query.Client.updateOne({ where: { id: transaction.client.id }, data: { lifetimeValue: Math.max(0, Number(transaction.client.lifetimeValue || 0) - checkoutRefundCents) }, query: "id" });
      await sudo.query.SalonTransaction.updateOne({ where: { id: transaction.id }, data: { metadata: { ...checkoutMetadata, pendingSaleReversal: null } }, query: "id" });
      return { success: true, reversalId: reversal.id, paymentDelta: -refundCents, error: null };
    });
    const prepared = await execute("prepare");
    if (!prepared.prepared) return prepared;
    for (const step of prepared.providers) {
      if (["refunded", "completed"].includes(prepared.operation.results?.[step.suffix]?.status)) continue;
      if (Date.now() - Date.parse(prepared.operation.createdAt) > 23 * 60 * 60 * 1e3) throw new Error("Refund reservation requires provider reconciliation before retrying");
      const result2 = await refundProviderPayment({ provider: paymentProviderFromRecord(step.provider), providerReference: step.providerReference, amount: step.amount, idempotencyKey: `${args.idempotencyKey}:provider:${step.suffix}` });
      await serializableWorkflow(context, "salon-sale-reversal", [`transaction:${args.transactionId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
        const current = await currentStockContext(tx, "return");
        const sudo = current.sudo();
        const record = await sudo.query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: "id metadata" });
        const metadata = record?.metadata;
        const operation = metadata?.pendingSaleReversal;
        if (!operation) {
          const posted = await domain(current).TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id conservationEvidence" });
          if (posted[0]?.conservationEvidence?.requestHash === requestHash) return;
          throw new Error("Refund reservation disappeared; reconciliation required");
        }
        if (operation.key !== args.idempotencyKey || operation.requestHash !== requestHash) throw new Error("Refund reservation identity changed");
        const observation = { status: result2.status, amount: result2.amount ?? null, providerReference: result2.providerReference || null, data: { refundId: typeof result2.data?.refundId === "string" ? result2.data.refundId : null } };
        await sudo.query.SalonTransaction.updateOne({ where: { id: args.transactionId }, data: { metadata: { ...metadata, pendingSaleReversal: { ...operation, results: { ...operation.results, [step.suffix]: observation } } } }, query: "id" });
      });
      if (!["refunded", "completed"].includes(result2.status) || result2.amount !== step.amount) throw new Error("Refund is pending or mismatched; reconcile the original operation");
    }
    return await execute("post");
  } catch (error) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const current = await currentStockContext(context, "return");
        const rows = await domain(current).TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id status paymentDelta conservationEvidence transaction { id }" });
        const receipt = rows[0];
        if (receipt?.status === "posted" && receipt.transaction?.id === args.transactionId && receipt.conservationEvidence?.requestHash === requestHash) return { success: true, reversalId: receipt.id, paymentDelta: receipt.paymentDelta, error: null };
      } catch {
        break;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return { ...denied8, error: error instanceof Error ? error.message : "Sale reversal failed" };
  }
}
async function adjustSaleCompensationTransaction(context, args) {
  if (!permissions.canManageCommissions({ session: context.session })) return { ...denied8, error: "Compensation authority is required" };
  if (!validKey4(args.idempotencyKey) || !args.reason.trim() || !Number.isInteger(args.commissionDelta) || !Number.isInteger(args.gratuityTransferCents) || args.gratuityTransferCents < 0 || !args.commissionId && args.commissionDelta !== 0 || args.gratuityTransferCents > 0 && (!args.sourceGratuityEntryId || !args.targetPractitionerId) || args.commissionDelta === 0 && args.gratuityTransferCents === 0) return { ...denied8, error: "Compensation adjustment input is invalid" };
  const requestHash = fingerprint({ transactionId: args.transactionId, commissionId: args.commissionId || null, commissionDelta: args.commissionDelta, sourceGratuityEntryId: args.sourceGratuityEntryId || null, targetPractitionerId: args.targetPractitionerId || null, gratuityTransferCents: args.gratuityTransferCents, reason: args.reason.trim() });
  try {
    return await serializableWorkflow(context, "salon-compensation-adjustment", [`transaction:${args.transactionId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
      const actor = await tx.query.User.findOne({ where: { id: context.session.itemId }, query: "id role { id name canManageSalon canManageCommissions }" });
      if (!actor || !permissions.canManageCommissions({ session: { ...context.session, data: { ...context.session.data, role: actor.role } } })) throw new Error("Current compensation authority is required");
      const query = domain(tx);
      const existing = (await query.TransactionReversal.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id paymentDelta conservationEvidence transaction { id }" }))[0];
      if (existing) {
        if (existing.transaction?.id !== args.transactionId || existing.conservationEvidence?.requestHash !== requestHash) throw new Error("Idempotency key was reused for different compensation evidence");
        return { success: true, reversalId: existing.id, paymentDelta: 0, error: null };
      }
      const transaction = await tx.sudo().query.SalonTransaction.findOne({ where: { id: args.transactionId }, query: "id appointment { payment { id } }" });
      if (!transaction?.appointment?.payment?.id) throw new Error("Settled transaction payment not found");
      let commission = null;
      if (args.commissionId) {
        commission = await tx.sudo().query.Commission.findOne({ where: { id: args.commissionId }, query: "id commissionAmount isPaid payment { id } adjustments { amountDelta }" });
        if (!commission || commission.payment?.id !== transaction.appointment.payment.id) throw new Error("Commission does not belong to the transaction payment");
        const adjusted = Number(commission.commissionAmount || 0) + commission.adjustments.reduce((sum, item) => sum + Number(item.amountDelta || 0), 0) + args.commissionDelta;
        if (adjusted < 0) throw new Error("Commission adjustment would create negative earnings");
      }
      let sourceTip = null;
      if (args.gratuityTransferCents > 0) {
        sourceTip = await query.GratuityLedgerEntry.findOne({ where: { id: args.sourceGratuityEntryId }, query: "id amountDelta payment { id } practitioner { id }" });
        if (!sourceTip || sourceTip.payment?.id !== transaction.appointment.payment.id || Number(sourceTip.amountDelta || 0) <= 0) throw new Error("Source gratuity allocation is invalid");
        const entries = await query.GratuityLedgerEntry.findMany({ where: { payment: { id: { equals: sourceTip.payment.id } }, practitioner: { id: { equals: sourceTip.practitioner.id } } }, take: 500, query: "amountDelta" });
        if (entries.reduce((sum, item) => sum + Number(item.amountDelta || 0), 0) < args.gratuityTransferCents) throw new Error("Gratuity transfer exceeds the practitioner allocation");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const reversal = await query.TransactionReversal.createOne({ data: {
        transaction: { connect: { id: transaction.id } },
        payment: { connect: { id: transaction.appointment.payment.id } },
        type: "compensation",
        status: "posted",
        subtotalDelta: 0,
        taxDelta: 0,
        tipDelta: 0,
        paymentDelta: 0,
        commissionDelta: args.commissionDelta,
        reason: args.reason.trim(),
        actor: { connect: { id: context.session.itemId } },
        idempotencyKey: args.idempotencyKey,
        postedAt: now,
        conservationEvidence: { requestHash, paymentDelta: 0, taxDelta: 0, tipTransferNet: 0, sourceCommissionId: args.commissionId || null }
      }, query: "id" });
      if (commission && args.commissionDelta !== 0) await query.CommissionAdjustment.createOne({ data: {
        commission: { connect: { id: commission.id } },
        reversal: { connect: { id: reversal.id } },
        amountDelta: args.commissionDelta,
        payablePeriod: commission.isPaid ? "next_open_period_adjustment" : "current_open_period",
        reason: args.reason.trim(),
        actor: { connect: { id: context.session.itemId } },
        postedAt: now,
        idempotencyKey: `${args.idempotencyKey}:commission`,
        evidence: { controlledCompensationCorrection: true }
      }, query: "id" });
      if (sourceTip) {
        for (const [suffix, practitionerId, delta, status] of [["debit", sourceTip.practitioner.id, -args.gratuityTransferCents, "recovery_due"], ["credit", args.targetPractitionerId, args.gratuityTransferCents, "payable"]]) {
          await query.GratuityLedgerEntry.createOne({ data: {
            payment: { connect: { id: sourceTip.payment.id } },
            reversal: { connect: { id: reversal.id } },
            practitioner: { connect: { id: practitionerId } },
            type: delta < 0 ? "recovery" : "allocation",
            amountDelta: delta,
            payoutStatus: status,
            reason: args.reason.trim(),
            actor: { connect: { id: context.session.itemId } },
            postedAt: now,
            idempotencyKey: `${args.idempotencyKey}:tip:${suffix}`,
            evidence: { transferPair: args.idempotencyKey, sourceEntryId: sourceTip.id }
          }, query: "id" });
        }
      }
      return { success: true, reversalId: reversal.id, paymentDelta: 0, error: null };
    });
  } catch (error) {
    return { ...denied8, error: error instanceof Error ? error.message : "Compensation adjustment failed" };
  }
}
var resultType11 = import_core77.graphql.object()({ name: "SaleReversalResult", fields: {
  success: import_core77.graphql.field({ type: import_core77.graphql.nonNull(import_core77.graphql.Boolean) }),
  reversalId: import_core77.graphql.field({ type: import_core77.graphql.ID }),
  paymentDelta: import_core77.graphql.field({ type: import_core77.graphql.Int }),
  error: import_core77.graphql.field({ type: import_core77.graphql.String })
} });
var adjustSaleCompensation = import_core77.graphql.field({
  type: resultType11,
  args: { transactionId: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.ID) }), commissionId: import_core77.graphql.arg({ type: import_core77.graphql.ID }), commissionDelta: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.Int) }), sourceGratuityEntryId: import_core77.graphql.arg({ type: import_core77.graphql.ID }), targetPractitionerId: import_core77.graphql.arg({ type: import_core77.graphql.ID }), gratuityTransferCents: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.Int) }), reason: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.String) }), idempotencyKey: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.String) }) },
  resolve(_source, args, context) {
    return adjustSaleCompensationTransaction(context, args);
  }
});
var reverseSalonTransaction = import_core77.graphql.field({
  type: resultType11,
  args: { transactionId: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.ID) }), type: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.String) }), lines: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.JSON) }), tipCents: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.Int) }), restorePackageCents: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.Int) }), reason: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.String) }), idempotencyKey: import_core77.graphql.arg({ type: import_core77.graphql.nonNull(import_core77.graphql.String) }) },
  resolve(_source, args, context) {
    return reverseSalonTransactionTransaction(context, args);
  }
});

// features/keystone/mutations/consultationWorkflows.ts
var import_node_crypto8 = require("node:crypto");
var import_core78 = require("@keystone-6/core");

// features/keystone/consultationAnswers.ts
function consultationAnswerError(questions, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return "Consultation answers must be an object keyed by question ID";
  }
  if (!Array.isArray(questions)) return "Consultation template questions are invalid";
  const answerMap = answers;
  const questionIds = /* @__PURE__ */ new Set();
  const normalizedQuestions = [];
  for (const value of questions) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "Consultation template questions are invalid";
    }
    const question = value;
    const id = String(question.id || "");
    if (!id || questionIds.has(id)) return "Consultation template questions are invalid";
    questionIds.add(id);
    normalizedQuestions.push({ id, required: Boolean(question.required) });
  }
  if (Object.keys(answerMap).some((id) => !questionIds.has(id))) {
    return "Answers contain a question not present in the signed template version";
  }
  for (const question of normalizedQuestions) {
    const hasAnswer = Object.prototype.hasOwnProperty.call(answerMap, question.id);
    if (!hasAnswer) {
      if (question.required) return `Required consultation answer is missing: ${question.id}`;
      continue;
    }
    const answer = answerMap[question.id];
    if (typeof answer !== "string") return `Consultation answer must be text: ${question.id}`;
    if (question.required && !answer.trim()) return `Required consultation answer is blank: ${question.id}`;
  }
  return null;
}

// features/keystone/mutations/consultationWorkflows.ts
var denied9 = { success: false, recordId: null, evidenceHash: null };
function domain2(context) {
  return context.sudo().query;
}
function validKey5(value) {
  return value.trim().length >= 12 && value.length <= 200;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value) {
  return (0, import_node_crypto8.createHash)("sha256").update(canonical(value)).digest("hex");
}
async function publishConsultationTemplateVersionTransaction(context, args) {
  if (!permissions.canManageCareRecords({ session: context.session })) return { ...denied9, error: "Restricted care-record authority is required" };
  if (!validKey5(args.idempotencyKey)) return { ...denied9, error: "Template idempotency key is invalid" };
  const effectiveFrom = new Date(args.effectiveFrom);
  const effectiveUntil = args.effectiveUntil ? new Date(args.effectiveUntil) : null;
  if (!args.version.trim() || !args.title.trim() || !args.purpose.trim() || !Array.isArray(args.questions) || args.questions.length === 0 || args.questions.length > 200 || Number.isNaN(effectiveFrom.getTime()) || effectiveUntil && (Number.isNaN(effectiveUntil.getTime()) || effectiveUntil <= effectiveFrom)) return { ...denied9, error: "Template version input is invalid" };
  const ids2 = /* @__PURE__ */ new Set();
  for (const question of args.questions) {
    const id = String(question?.id || "");
    if (!id || ids2.has(id) || !String(question?.label || "")) return { ...denied9, error: "Every consultation question requires a unique ID and label" };
    ids2.add(id);
  }
  const questionsHash = hash(args.questions);
  const documentHash = hash({ templateId: args.templateId, version: args.version, title: args.title.trim(), purpose: args.purpose.trim(), questionsHash, effectiveFrom: effectiveFrom.toISOString(), effectiveUntil: effectiveUntil?.toISOString() || null });
  try {
    return await serializableWorkflow(context, "salon-consultation-template", [`template:${args.templateId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
      const query = domain2(tx);
      const existing = (await query.ConsultationTemplateVersion.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id documentHash template { id }" }))[0];
      if (existing) {
        if (existing.template?.id !== args.templateId || existing.documentHash !== documentHash) throw new Error("Template idempotency key was reused for different evidence");
        return { success: true, recordId: existing.id, evidenceHash: existing.documentHash, error: null };
      }
      const template = await tx.sudo().query.FormTemplate.findOne({ where: { id: args.templateId }, query: "id" });
      if (!template) throw new Error("Form template not found");
      if (args.supersedesId) {
        const prior = await query.ConsultationTemplateVersion.findOne({ where: { id: args.supersedesId }, query: "id template { id } supersededBy { id }" });
        if (!prior || prior.template?.id !== args.templateId || prior.supersededBy?.id) throw new Error("Template supersession is invalid");
      }
      const record = await query.ConsultationTemplateVersion.createOne({ data: {
        template: { connect: { id: args.templateId } },
        version: args.version.trim(),
        titleSnapshot: args.title.trim(),
        purposeSnapshot: args.purpose.trim(),
        questions: args.questions,
        questionsHash,
        documentHash,
        idempotencyKey: args.idempotencyKey,
        effectiveFrom: effectiveFrom.toISOString(),
        effectiveUntil: effectiveUntil?.toISOString(),
        supersedes: args.supersedesId ? { connect: { id: args.supersedesId } } : void 0
      }, query: "id documentHash" });
      return { success: true, recordId: record.id, evidenceHash: record.documentHash, error: null };
    });
  } catch (error) {
    return { ...denied9, error: error instanceof Error ? error.message : "Template publication failed" };
  }
}
async function submitConsultationTransaction(context, args) {
  if (!context.session?.itemId) return { ...denied9, error: "A verified client or authorized care session is required" };
  if (!validKey5(args.idempotencyKey)) return { ...denied9, error: "Submission idempotency key is invalid" };
  const serialized = canonical(args.answers);
  if (!args.signerName.trim() || args.signerName.length > 200 || !args.signatureEvidence.trim() || args.signatureEvidence.length > 5e3 || serialized.length > 1e5 || !(/* @__PURE__ */ new Set(["self", "parent", "guardian", "representative"])).has(args.signerRole) || args.signerRole !== "self" && !args.guardianAuthority?.trim()) return { ...denied9, error: "Signer, authority, signature, or answers are invalid" };
  try {
    return await serializableWorkflow(context, "salon-consultation-submission", [`client:${context.session.itemId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
      const query = domain2(tx);
      const existing = (await query.ConsultationSubmission.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id evidenceHash answersHash signerName signerRole guardianAuthority signatureEvidence client { id } appointment { id } templateVersion { id }" }))[0];
      if (existing) {
        if (existing.client?.id !== context.session.itemId && !permissions.canManageCareRecords({ session: context.session })) throw new Error("Submission idempotency ownership mismatch");
        if (existing.templateVersion?.id !== args.templateVersionId || (existing.appointment?.id || null) !== (args.appointmentId || null) || existing.answersHash !== hash(args.answers) || existing.signerName !== args.signerName.trim() || existing.signerRole !== args.signerRole || (existing.guardianAuthority || "") !== (args.guardianAuthority?.trim() || "") || existing.signatureEvidence !== args.signatureEvidence) throw new Error("Submission idempotency key was reused for different evidence");
        return { success: true, recordId: existing.id, evidenceHash: existing.evidenceHash, error: null };
      }
      const version = await query.ConsultationTemplateVersion.findOne({ where: { id: args.templateVersionId }, query: "id version titleSnapshot purposeSnapshot questions questionsHash documentHash effectiveFrom effectiveUntil" });
      if (!version) throw new Error("Consultation template version not found");
      const now = /* @__PURE__ */ new Date();
      if (new Date(version.effectiveFrom) > now || version.effectiveUntil && new Date(version.effectiveUntil) <= now) throw new Error("Consultation template version is not currently effective");
      const actorIsCare = permissions.canManageCareRecords({ session: context.session });
      let clientId = context.session.itemId;
      if (args.appointmentId) {
        const appointment = await tx.sudo().query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id client { user { id } }" });
        if (!appointment) throw new Error("Appointment not found");
        if (appointment.client?.user?.id !== context.session.itemId && !actorIsCare) throw new Error("You cannot submit a consultation for this appointment");
        clientId = appointment.client?.user?.id || context.session.itemId;
      }
      if (args.supersedesId) {
        const prior = await query.ConsultationSubmission.findOne({ where: { id: args.supersedesId }, query: "id client { id } templateVersion { id } supersededBy { id }" });
        if (!prior || prior.client?.id !== clientId || prior.templateVersion?.id !== version.id || prior.supersededBy?.id) throw new Error("Consultation supersession is invalid");
      }
      const answerError = consultationAnswerError(version.questions, args.answers);
      if (answerError) throw new Error(answerError);
      const answerMap = args.answers;
      const answersHash = hash(answerMap);
      const submittedAt = now.toISOString();
      const evidenceHash = hash({ documentHash: version.documentHash, questionsHash: version.questionsHash, answersHash, signerName: args.signerName.trim(), signerRole: args.signerRole, guardianAuthority: args.guardianAuthority?.trim() || null, signatureEvidenceHash: hash(args.signatureEvidence), clientId, appointmentId: args.appointmentId || null, submittedAt });
      const record = await query.ConsultationSubmission.createOne({ data: {
        client: { connect: { id: clientId } },
        appointment: args.appointmentId ? { connect: { id: args.appointmentId } } : void 0,
        templateVersion: { connect: { id: version.id } },
        answers: answerMap,
        questionsHash: version.questionsHash,
        answersHash,
        evidenceHash,
        signerName: args.signerName.trim(),
        signerRole: args.signerRole,
        guardianAuthority: args.guardianAuthority?.trim() || "",
        signatureEvidence: args.signatureEvidence,
        actor: { connect: { id: context.session.itemId } },
        actorAuthority: actorIsCare ? "care_record_operator" : args.signerRole === "self" ? "authenticated_client_owner" : "authenticated_guardian_or_representative",
        submittedAt,
        effectiveFrom: submittedAt,
        supersedes: args.supersedesId ? { connect: { id: args.supersedesId } } : void 0,
        idempotencyKey: args.idempotencyKey,
        reviewStatus: "submitted"
      }, query: "id evidenceHash" });
      return { success: true, recordId: record.id, evidenceHash: record.evidenceHash, error: null };
    });
  } catch (error) {
    return { ...denied9, error: error instanceof Error ? error.message : "Consultation submission failed" };
  }
}
async function reviewConsultationTransaction(context, args) {
  if (!permissions.canManageCareRecords({ session: context.session })) return { ...denied9, error: "Restricted care-record authority is required" };
  if (!validKey5(args.idempotencyKey) || !(/* @__PURE__ */ new Set(["reviewed", "needs_clarification", "accepted_for_service", "deferred"])).has(args.status) || !args.reason.trim()) return { ...denied9, error: "Review input is invalid" };
  try {
    return await serializableWorkflow(context, "salon-consultation-review", [`submission:${args.submissionId}`, `idempotency:${args.idempotencyKey}`], async (tx) => {
      const query = domain2(tx);
      const existing = (await query.ConsultationReview.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id status reason evidence submission { id }" }))[0];
      if (existing) {
        if (existing.submission?.id !== args.submissionId || existing.status !== args.status || existing.reason !== args.reason.trim()) throw new Error("Review idempotency key was reused for another decision");
        await query.ConsultationSubmission.updateOne({ where: { id: args.submissionId }, data: { reviewStatus: existing.status }, query: "id" });
        return { success: true, recordId: existing.id, evidenceHash: hash(existing.evidence), error: null };
      }
      const submission = await query.ConsultationSubmission.findOne({ where: { id: args.submissionId }, query: "id evidenceHash" });
      if (!submission) throw new Error("Consultation submission not found");
      const occurredAt = (/* @__PURE__ */ new Date()).toISOString();
      const evidence = { submissionEvidenceHash: submission.evidenceHash, status: args.status, reason: args.reason.trim(), actorId: context.session.itemId, occurredAt };
      const review = await query.ConsultationReview.createOne({ data: { submission: { connect: { id: submission.id } }, status: args.status, reason: args.reason.trim(), actor: { connect: { id: context.session.itemId } }, actorAuthority: "care_record_reviewer", occurredAt, idempotencyKey: args.idempotencyKey, evidence }, query: "id" });
      await query.ConsultationSubmission.updateOne({ where: { id: submission.id }, data: { reviewStatus: args.status }, query: "id" });
      return { success: true, recordId: review.id, evidenceHash: hash(evidence), error: null };
    });
  } catch (error) {
    return { ...denied9, error: error instanceof Error ? error.message : "Consultation review failed" };
  }
}
var resultType12 = import_core78.graphql.object()({ name: "ConsultationWorkflowResult", fields: { success: import_core78.graphql.field({ type: import_core78.graphql.nonNull(import_core78.graphql.Boolean) }), recordId: import_core78.graphql.field({ type: import_core78.graphql.ID }), evidenceHash: import_core78.graphql.field({ type: import_core78.graphql.String }), error: import_core78.graphql.field({ type: import_core78.graphql.String }) } });
var publishConsultationTemplateVersion = import_core78.graphql.field({ type: resultType12, args: { templateId: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.ID) }), version: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), title: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), purpose: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), questions: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.JSON) }), effectiveFrom: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), effectiveUntil: import_core78.graphql.arg({ type: import_core78.graphql.String }), supersedesId: import_core78.graphql.arg({ type: import_core78.graphql.ID }), idempotencyKey: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }) }, resolve(_source, args, context) {
  return publishConsultationTemplateVersionTransaction(context, args);
} });
var submitConsultation = import_core78.graphql.field({ type: resultType12, args: { templateVersionId: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.ID) }), appointmentId: import_core78.graphql.arg({ type: import_core78.graphql.ID }), answers: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.JSON) }), signerName: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), signerRole: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), guardianAuthority: import_core78.graphql.arg({ type: import_core78.graphql.String }), signatureEvidence: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), supersedesId: import_core78.graphql.arg({ type: import_core78.graphql.ID }), idempotencyKey: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }) }, resolve(_source, args, context) {
  return submitConsultationTransaction(context, args);
} });
var reviewConsultation = import_core78.graphql.field({ type: resultType12, args: { submissionId: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.ID) }), status: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), reason: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }), idempotencyKey: import_core78.graphql.arg({ type: import_core78.graphql.nonNull(import_core78.graphql.String) }) }, resolve(_source, args, context) {
  return reviewConsultationTransaction(context, args);
} });

// features/keystone/extendGraphqlSchema/clientPortal.ts
var import_core79 = require("@keystone-6/core");
var clientPortal = import_core79.graphql.field({
  type: import_core79.graphql.JSON,
  async resolve(_source, _args, context) {
    const userId = context.session?.itemId;
    if (!userId || context.session?.listKey !== "User") return { authenticated: false, client: null, appointments: [], availableForms: [] };
    const appointments = await context.query.Appointment.findMany({
      where: { client: { user: { id: { equals: userId } } } },
      orderBy: { startTime: "desc" },
      take: 100,
      query: `id startTime endTime duration status bookedAt confirmedAt cancelledAt cancellationReason clientNotes clientPolicy
        stylist { id user { name } } location { name timezone }
        lineItems { id serviceTitle serviceImagePath duration price quantity }
        scheduleRevisions(orderBy: { revision: desc }, take: 10) { id revision priorStart priorEnd nextStart nextEnd scheduleHash createdAt }
        segments(where: { status: { notIn: [superseded] } }, orderBy: { plannedStart: asc }) { id stableKey sequence parallelGroup type plannedStart plannedEnd durationMinutes practitionerRequired resourceUnits status lineItem { id } definition { id } practitioner { id user { name } } resource { id name } }
        consultationSubmissions(orderBy: { submittedAt: desc }) { id evidenceHash submittedAt effectiveFrom effectiveUntil signerName signerRole templateVersion { id version titleSnapshot questionsHash documentHash } reviews(orderBy: { occurredAt: desc }) { status reason occurredAt } }
        transaction { id completedAt paymentStatus status tip metadata lineItems { id itemType quantity unitPrice discount metadata } reversals(orderBy: { postedAt: desc }) { id type status subtotalDelta taxDelta tipDelta paymentDelta postedAt lines { sourceLine { id } quantity subtotalDelta taxDelta inventoryDisposition } } }
        payment { id subtotal tax tip discount totalAmount refundedAmount paymentMethod status processedAt refundedAt }
      `
    });
    const clients2 = await context.query.Client.findMany({ where: { user: { id: { equals: userId } } }, take: 1, query: "id totalVisits lifetimeValue user { name email }" });
    if (!clients2[0]) return { authenticated: false, client: null, appointments: [], availableForms: [] };
    const practitionerIds = [...new Set(appointments.flatMap((appointment) => [appointment.stylist?.id, ...(appointment.segments || []).map((segment) => segment.practitioner?.id)]).filter(Boolean))];
    const practitioners = practitionerIds.length ? await context.sudo().query.Stylist.findMany({ where: { id: { in: practitionerIds } }, take: 200, query: "id user { name }" }) : [];
    const names = new Map(practitioners.map((item) => [item.id, item.user?.name || null]));
    const activeTemplates = await context.sudo().query.FormTemplate.findMany({ where: { isActive: { equals: true } }, take: 50, query: "id name type description" });
    const domain3 = context.sudo().query;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const versions = await domain3.ConsultationTemplateVersion.findMany({
      where: { effectiveFrom: { lte: now }, OR: [{ effectiveUntil: { equals: null } }, { effectiveUntil: { gt: now } }] },
      take: 100,
      query: "id version titleSnapshot purposeSnapshot questions questionsHash documentHash effectiveFrom effectiveUntil template { id } supersededBy { id }"
    });
    const availableForms = versions.filter((version) => !version.supersededBy?.id && activeTemplates.some((template) => template.id === version.template?.id));
    return {
      authenticated: true,
      client: clients2[0] || null,
      appointments: appointments.map((appointment) => ({
        ...appointment,
        stylist: appointment.stylist ? { user: { name: names.get(appointment.stylist.id) || null } } : null,
        segments: (appointment.segments || []).map((segment) => ({ ...segment, practitioner: segment.practitioner ? { id: segment.practitioner.id, user: { name: names.get(segment.practitioner.id) || null } } : null })),
        // Only policy snapshot and transition evidence are client-safe.
        metadata: {
          clientPolicySnapshot: appointment.clientPolicy || null,
          transitionHistory: Array.isArray(appointment.metadata?.transitionHistory) ? appointment.metadata.transitionHistory.map((event) => ({ from: event.from, to: event.to, reason: event.reason, at: event.at })) : []
        },
        transaction: appointment.transaction ? {
          ...appointment.transaction,
          metadata: {
            serviceSubtotal: appointment.transaction.metadata?.serviceSubtotal || 0,
            retailSubtotal: appointment.transaction.metadata?.retailSubtotal || 0,
            discount: appointment.transaction.metadata?.discount || 0,
            tax: appointment.transaction.metadata?.tax || 0,
            total: appointment.transaction.metadata?.total || 0,
            packageCredit: appointment.transaction.metadata?.packageCredit || 0,
            depositCredit: appointment.transaction.metadata?.depositCredit || 0
          }
        } : null
      })),
      availableForms
    };
  }
});

// features/keystone/extendGraphqlSchema/publicStorefrontSettings.ts
var import_core80 = require("@keystone-6/core");
var publicLocationType = import_core80.graphql.object()({
  name: "PublicSalonLocation",
  fields: {
    id: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.ID) }),
    name: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    address: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    city: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    state: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    zipCode: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    phone: import_core80.graphql.field({ type: import_core80.graphql.String }),
    email: import_core80.graphql.field({ type: import_core80.graphql.String }),
    hours: import_core80.graphql.field({ type: import_core80.graphql.JSON, resolve: (source) => source.hours }),
    timezone: import_core80.graphql.field({ type: import_core80.graphql.String })
  }
});
var publicStorefrontSettingsType = import_core80.graphql.object()({
  name: "PublicSalonStorefrontSettings",
  fields: {
    configured: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.Boolean) }),
    name: import_core80.graphql.field({ type: import_core80.graphql.String }),
    description: import_core80.graphql.field({ type: import_core80.graphql.String }),
    themeHue: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.Int) }),
    logoIcon: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    logoColor: import_core80.graphql.field({ type: import_core80.graphql.nonNull(import_core80.graphql.String) }),
    primaryLocation: import_core80.graphql.field({ type: publicLocationType })
  }
});
var unconfigured = () => ({
  configured: false,
  name: null,
  description: null,
  themeHue: UNCONFIGURED_STOREFRONT_HUE,
  logoIcon: "",
  logoColor: "0",
  primaryLocation: null
});
var publicStorefrontSettings = import_core80.graphql.field({
  type: import_core80.graphql.nonNull(publicStorefrontSettingsType),
  async resolve(_source, _args, context) {
    const rows = await context.sudo().query.StoreSettings.findMany({
      where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
      take: 2,
      orderBy: { createdAt: "asc" },
      query: `
        id
        name
        description
        themeHue logoIcon logoColor
        primaryLocation {
          id name address city state zipCode phone email hours timezone isActive
        }
      `
    });
    if (rows.length !== 1) return unconfigured();
    const settings = rows[0];
    const name = typeof settings.name === "string" ? settings.name.trim() : "";
    const location = settings.primaryLocation;
    if (!name || !location?.id || location.isActive !== true) return unconfigured();
    return {
      configured: true,
      name,
      description: typeof settings.description === "string" && settings.description.trim() ? settings.description.trim() : null,
      themeHue: safeStorefrontHue(settings.themeHue),
      logoIcon: sanitizeStoreLogoSvg(settings.logoIcon || ""),
      logoColor: normalizeStoreLogoColor(settings.logoColor),
      primaryLocation: {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone || null,
        email: location.email || null,
        hours: location.hours || null,
        timezone: location.timezone || null
      }
    };
  }
});

// features/keystone/mutations/storeSettings.ts
var import_core81 = require("@keystone-6/core");
var resultType13 = import_core81.graphql.object()({
  name: "SalonStoreSettingsMutationResult",
  fields: {
    id: import_core81.graphql.field({ type: import_core81.graphql.nonNull(import_core81.graphql.ID) }),
    name: import_core81.graphql.field({ type: import_core81.graphql.nonNull(import_core81.graphql.String) }),
    description: import_core81.graphql.field({ type: import_core81.graphql.String }),
    themeHue: import_core81.graphql.field({ type: import_core81.graphql.nonNull(import_core81.graphql.Int) }),
    primaryLocationId: import_core81.graphql.field({ type: import_core81.graphql.nonNull(import_core81.graphql.ID) })
  }
});
function boundedText(value, label, max, required = false) {
  const text55 = typeof value === "string" ? value.trim() : "";
  if (required && !text55) throw new Error(`${label} is required`);
  if (text55.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return text55;
}
async function upsertSalonStoreSettingsTransaction(context, input) {
  if (!context.session || context.session.data?.role?.canManageSalon !== true) {
    throw new Error("You do not have permission to manage storefront settings");
  }
  const name = boundedText(input.name, "Storefront name", 120, true);
  const description = boundedText(input.description, "Storefront description", 240);
  const themeHue = parseStorefrontHue(input.themeHue);
  const primaryLocationId = boundedText(input.primaryLocationId, "Primary location", 200, true);
  const location = await context.query.Location.findOne({
    where: { id: primaryLocationId },
    query: "id isActive"
  });
  if (!location || location.isActive !== true) {
    throw new Error("Primary location must be an active location you can manage");
  }
  const logoIcon = input.logoIcon == null ? void 0 : sanitizeStoreLogoSvg(input.logoIcon);
  if (input.logoIcon && !logoIcon) throw new Error("Logo must be a valid, safe SVG document");
  const logoColor = input.logoColor == null ? void 0 : normalizeStoreLogoColor(input.logoColor);
  return serializableWorkflow(context, "salon-store-settings", [STOREFRONT_SETTINGS_SCOPE], async (transactionContext) => {
    const actor = await transactionContext.query.User.findOne({ where: { id: context.session.itemId }, query: "id role { canManageSalon }" });
    if (actor?.role?.canManageSalon !== true) throw new Error("Current store settings authority is required");
    const active = await transactionContext.query.Location.findOne({ where: { id: primaryLocationId }, query: "id isActive" });
    if (!active?.isActive) throw new Error("Primary location is no longer active");
    const sudo = transactionContext.sudo();
    const existing = await sudo.query.StoreSettings.findMany({
      where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
      take: 2,
      orderBy: { createdAt: "asc" },
      query: "id"
    });
    if (existing.length > 1) throw new Error("Storefront settings invariant violated");
    const data = {
      scope: STOREFRONT_SETTINGS_SCOPE,
      name,
      description: description || null,
      themeHue,
      ...logoIcon === void 0 ? {} : { logoIcon },
      ...logoColor === void 0 ? {} : { logoColor },
      primaryLocation: { connect: { id: primaryLocationId } }
    };
    const record = existing[0] ? await sudo.query.StoreSettings.updateOne({ where: { id: existing[0].id }, data, query: "id name description themeHue primaryLocation { id }" }) : await sudo.query.StoreSettings.createOne({ data, query: "id name description themeHue primaryLocation { id }" });
    return {
      id: record.id,
      name: record.name,
      description: record.description || null,
      themeHue: record.themeHue,
      primaryLocationId: record.primaryLocation?.id || primaryLocationId
    };
  });
}
var upsertSalonStoreSettings = import_core81.graphql.field({
  type: import_core81.graphql.nonNull(resultType13),
  args: {
    name: import_core81.graphql.arg({ type: import_core81.graphql.nonNull(import_core81.graphql.String) }),
    description: import_core81.graphql.arg({ type: import_core81.graphql.String }),
    themeHue: import_core81.graphql.arg({ type: import_core81.graphql.nonNull(import_core81.graphql.Int) }),
    primaryLocationId: import_core81.graphql.arg({ type: import_core81.graphql.nonNull(import_core81.graphql.ID) }),
    logoIcon: import_core81.graphql.arg({ type: import_core81.graphql.String }),
    logoColor: import_core81.graphql.arg({ type: import_core81.graphql.String })
  },
  resolve(_source, args, context) {
    return upsertSalonStoreSettingsTransaction(context, args);
  }
});

// features/keystone/mutations/managementWorkflows.ts
var import_node_crypto9 = require("node:crypto");
var import_core82 = require("@keystone-6/core");
var config = {
  client: { list: "Client", permission: permissions.canManageClients, fields: ["name", "email", "phone", "homeLocationId"] },
  staff: { list: "Stylist", permission: permissions.canManagePeople, fields: ["name", "email", "phone", "locationIds", "serviceIds", "tier", "role", "status", "baseCommissionRate"] },
  location: { list: "Location", permission: permissions.canManageSalon, fields: ["name", "address", "city", "state", "zipCode", "phone", "email", "timezone", "hours", "isActive"] },
  resource: { list: "SalonResource", permission: permissions.canManageResources, fields: ["name", "type", "locationId", "capacity", "isActive"] },
  product: { list: "Product", permission: permissions.canManageInventory, fields: ["name", "sku", "price", "cost", "reorderPoint", "category", "description", "isActive"] },
  service: { list: "Service", permission: permissions.canManageCatalog, fields: ["name", "description", "price", "baseDuration", "status", "categoryId", "specialistIds", "resourceIds"] },
  category: { list: "ServiceCategory", permission: permissions.canManageCatalog, fields: ["name", "slug", "description", "displayOrder", "sortOrder", "isVisible"] }
};
var denied10 = { success: false, recordId: null };
function ids(value) {
  if (!Array.isArray(value) || value.length > 100 || value.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) throw new Error("Relationship selection is invalid");
  return [...new Set(value.map((id) => id.trim()))];
}
function text54(value, required = false) {
  const result2 = typeof value === "string" ? value.trim() : "";
  if (required && !result2 || result2.length > 2e3) throw new Error("A required text field is missing or too long");
  return result2;
}
function integer38(value, minimum = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > 1e7) throw new Error("Use a valid integer amount or quantity");
  return Number(value);
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
  return value;
}
var SAFE_MANAGEMENT_ERRORS = /* @__PURE__ */ new Set(["A required text field is missing or too long", "Relationship selection is invalid", "Use a valid integer amount or quantity", "A valid operation key is required", "Operation input is invalid", "This operation cannot edit the supplied field", "Record not found", "A valid client or staff email is required", "An account already uses that email; do not merge identities without verified ownership", "A valid timezone is required", "Location email is invalid", "Location activity must be boolean", "Location hours are invalid", "Provide valid hours for every weekday", "Timezone changes require explicit schedule migration", "Reschedule active resource reservations before changing capacity or location", "Reschedule active bookings before removing a staff location", "Resource activity must be boolean", "Resource type is invalid", "Product activity must be boolean", "Service status is invalid", "Service duration cannot exceed eight hours", "Staff status is invalid", "Staff location is required", "Staff member has active reservations and cannot be deactivated", "Commission authority is required to change staff compensation", "Category slug is invalid", "Category visibility must be boolean", "Category not found", "Location selection was not found", "Service selection was not found", "Stylist selection was not found", "SalonResource selection was not found", "ServiceCategory selection was not found", "Location has active reservations and cannot be disabled", "A supported role is required"]);
async function saveSalonRecordTransaction(context, args) {
  const kind = args.kind, definition = Object.hasOwn(config, args.kind) ? config[kind] : void 0;
  if (!definition || !definition.permission({ session: context.session })) return { ...denied10, error: "You do not have authority for this operation" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 160) return { ...denied10, error: "A valid operation key is required" };
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) return { ...denied10, error: "Operation input is invalid" };
  const input = args.input;
  if (Object.keys(input).some((key) => !definition.fields.includes(key))) return { ...denied10, error: "This operation cannot edit the supplied field" };
  const requestHash = (0, import_node_crypto9.createHash)("sha256").update(JSON.stringify(stable({ kind, id: args.id || null, input }))).digest("hex");
  const eventKey = `management:${context.session.itemId}:${args.idempotencyKey}`;
  try {
    return await serializableWorkflow(context, "salon-management", [eventKey, `${kind}:${args.id || input.email || input.sku || input.name}`], async (tx) => {
      const sudo = tx.sudo(), query = sudo.query;
      const existing = await query.DomainEvent.findOne({ where: { eventKey }, query: "aggregateId payload" });
      if (existing) {
        if (existing.payload?.requestHash !== requestHash) throw new Error("Operation key was reused with different input");
        return { success: true, recordId: existing.aggregateId, error: null };
      }
      const priorQueries = {
        client: "id user { id email } homeLocation { id }",
        staff: "id status tier role baseCommissionRate user { id email } locations { id }",
        location: "id timezone isActive",
        resource: "id capacity isActive location { id }",
        product: "id sku price cost reorderPoint category description isActive",
        service: "id price basePrice baseDuration status category { id } specialists { id } requiredResources { id }",
        category: "id name slug description displayOrder sortOrder isVisible"
      };
      const prior = args.id ? await query[definition.list].findOne({ where: { id: args.id }, query: priorQueries[kind] }) : null;
      if (args.id && !prior) throw new Error("Record not found");
      const connect = async (list59, id) => {
        const record2 = await query[list59].findOne({ where: { id: text54(id, true) }, query: "id" });
        if (!record2) throw new Error(`${list59} selection was not found`);
        return { connect: { id: record2.id } };
      };
      const activeLocation = async (id, existingId) => {
        const location = await query.Location.findOne({ where: { id: text54(id, true) }, query: "id isActive" });
        if (!location || !location.isActive && location.id !== existingId) throw new Error("Location selection was not found");
        return { connect: { id: location.id } };
      };
      const many = async (list59, value, existingIds = [], creating = false) => {
        const selectedIds = ids(value);
        if (!selectedIds.length) return creating ? { connect: [] } : { set: [] };
        const selection = list59 === "Stylist" ? "id status isActive" : list59 === "SalonResource" || list59 === "Location" ? "id isActive" : "id status";
        const records = await query[list59].findMany({ where: { id: { in: selectedIds } }, take: selectedIds.length, query: selection });
        if (records.length !== selectedIds.length || records.some((record2) => (record2.status === "inactive" || record2.status === "on_leave" || record2.isActive === false) && !existingIds.includes(record2.id))) throw new Error(`${list59} selection was not found`);
        const connections = records.map((record2) => ({ id: record2.id }));
        return creating ? { connect: connections } : { set: connections };
      };
      let data = {};
      if (kind === "client" || kind === "staff") {
        const name = text54(input.name, true), phone = text54(input.phone);
        let userId = prior?.user?.id;
        if (userId) {
          if (input.email && input.email.toLowerCase() !== prior.user.email.toLowerCase()) throw new Error("Account email changes require the separate verified identity workflow");
          await query.User.updateOne({ where: { id: userId }, data: { name, phone }, query: "id" });
        } else {
          const email = text54(input.email, true).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid client or staff email is required");
          if (await query.User.findOne({ where: { email }, query: "id" })) throw new Error("An account already uses that email; do not merge identities without verified ownership");
          const user = await query.User.createOne({ data: { name, email, phone, password: `${(0, import_node_crypto9.randomUUID)()}-${(0, import_node_crypto9.randomUUID)()}` }, query: "id" });
          userId = user.id;
        }
        data.user = { connect: { id: userId } };
        if (kind === "client" && Object.hasOwn(input, "homeLocationId")) {
          if (input.homeLocationId) data.homeLocation = await activeLocation(input.homeLocationId, prior?.homeLocation?.id);
          else if (prior) data.homeLocation = { disconnect: true };
        }
        if (kind === "staff") {
          const nextLocationIds = ids(input.locationIds);
          if (!nextLocationIds.length) throw new Error("Staff location is required");
          if (nextLocationIds.some((id) => !prior?.locations?.some((location) => location.id === id)) || prior && nextLocationIds.length !== prior.locations.length) {
            data.locations = await many("Location", nextLocationIds, (prior?.locations || []).map((location) => location.id), !prior);
          }
          if (prior) {
            const removedLocations = prior.locations.some((location) => !nextLocationIds.includes(location.id));
            if (removedLocations) {
              const appointments = await query.Appointment.count({ where: { stylist: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } });
              const segments = await query.AppointmentSegment.count({ where: { practitioner: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } } });
              if (appointments || segments) throw new Error("Reschedule active bookings before removing a staff location");
            }
          }
          if (input.serviceIds) data.specializations = await many("Service", input.serviceIds, (prior?.specializations || []).map((service) => service.id), !prior);
          if (input.tier) {
            const tier = text54(input.tier);
            if (!["junior", "senior", "master", "celebrity"].includes(tier)) throw new Error("A supported role is required");
            data.tier = tier;
          }
          if (input.role) {
            const role = text54(input.role);
            if (!["stylist", "colorist", "nail_tech", "esthetician", "massage_therapist", "manager", "receptionist"].includes(role)) throw new Error("A supported role is required");
            data.role = role;
          }
          if (input.baseCommissionRate !== void 0) {
            if (!permissions.canManageCommissions({ session: context.session })) throw new Error("Commission authority is required to change staff compensation");
            const rate = Number(input.baseCommissionRate);
            if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("Commission rate must be a decimal from 0 to 1");
            data.baseCommissionRate = rate;
            data.commissionRate = rate;
          }
          const nextStatus = input.status === void 0 ? prior?.status || "active" : text54(input.status);
          if (!["active", "on_leave", "inactive"].includes(nextStatus)) throw new Error("Staff status is invalid");
          if (!prior) {
            data.role = data.role || "stylist";
            data.status = nextStatus;
            data.isActive = nextStatus === "active";
          } else if (input.status !== void 0) {
            if (nextStatus !== "active") {
              const appointments = await query.Appointment.count({ where: { stylist: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } });
              const segments = await query.AppointmentSegment.count({ where: { practitioner: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } } });
              if (appointments || segments) throw new Error("Staff member has active reservations and cannot be deactivated");
            }
            data.status = nextStatus;
            data.isActive = nextStatus === "active";
          }
        }
      } else if (kind === "location") {
        for (const key of ["name", "address", "city", "state", "zipCode"]) data[key] = text54(input[key], true);
        data.phone = text54(input.phone);
        data.email = text54(input.email);
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error("Location email is invalid");
        data.timezone = text54(input.timezone, true);
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }).format();
        } catch {
          throw new Error("A valid timezone is required");
        }
        if (input.hours !== void 0) {
          if (!input.hours || typeof input.hours !== "object" || Array.isArray(input.hours)) throw new Error("Location hours are invalid");
          const normalized = {};
          for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
            const h = input.hours[day];
            if (!h || typeof h.closed !== "boolean") throw new Error("Provide valid hours for every weekday");
            if (h.closed) normalized[day] = { open: null, close: null, closed: true };
            else {
              if (typeof h.open !== "string" || typeof h.close !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close) || h.open >= h.close) throw new Error("Provide valid hours for every weekday");
              normalized[day] = { open: h.open, close: h.close, closed: false };
            }
          }
          data.hours = normalized;
        }
        if (input.isActive !== void 0) {
          if (typeof input.isActive !== "boolean") throw new Error("Location activity must be boolean");
          if (prior && prior.isActive && input.isActive === false) {
            const appointments = await query.Appointment.count({ where: { location: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } });
            if (appointments) throw new Error("Location has active reservations and cannot be disabled");
          }
          data.isActive = input.isActive;
        }
        if (prior && prior.timezone !== data.timezone) {
          const [appointments, schedules] = await Promise.all([
            query.Appointment.count({ where: { location: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } }),
            query.StylistSchedule.count({ where: { location: { id: { equals: prior.id } } } })
          ]);
          if (appointments || schedules) throw new Error("Timezone changes require explicit schedule migration");
        }
      } else if (kind === "resource") {
        const name = text54(input.name, true), type = text54(input.type || "station"), capacity = integer38(input.capacity, 1);
        if (!["station", "room", "shampoo_bowl", "equipment", "color_bar", "other"].includes(type)) throw new Error("Resource type is invalid");
        const location = await activeLocation(input.locationId, prior?.location?.id);
        const isActive = input.isActive === void 0 ? prior?.isActive ?? true : input.isActive;
        if (typeof isActive !== "boolean") throw new Error("Resource activity must be boolean");
        if (prior && (prior.capacity !== capacity || prior.location?.id !== input.locationId || prior.isActive !== isActive)) {
          const [booked, segments] = await Promise.all([
            query.Appointment.count({ where: { resource: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } }),
            query.AppointmentSegment.count({ where: { resource: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: /* @__PURE__ */ new Date() } } } })
          ]);
          if (booked || segments) throw new Error("Reschedule active resource reservations before changing capacity or location");
        }
        data = { name, type, capacity, location, isActive };
      } else if (kind === "product") {
        data = { name: text54(input.name, true), sku: text54(input.sku, true), price: integer38(input.price), cost: integer38(input.cost ?? 0), reorderPoint: integer38(input.reorderPoint ?? 5), category: text54(input.category), description: text54(input.description) };
        if (input.isActive !== void 0) {
          if (typeof input.isActive !== "boolean") throw new Error("Product activity must be boolean");
          data.isActive = input.isActive;
        }
      } else if (kind === "service") {
        const status = input.status ?? (prior?.status || "active");
        if (!["active", "inactive"].includes(status)) throw new Error("Service status is invalid");
        const price = integer38(input.price), baseDuration = integer38(input.baseDuration, 1);
        if (baseDuration > 480) throw new Error("Service duration cannot exceed eight hours");
        data = { name: text54(input.name, true), description: text54(input.description), price, basePrice: price, baseDuration, status };
        if (input.categoryId) data.category = await connect("ServiceCategory", input.categoryId);
        else if (input.categoryId !== void 0 && prior) data.category = { disconnect: true };
        if (input.specialistIds !== void 0) data.specialists = await many("Stylist", input.specialistIds, (prior?.specialists || []).map((stylist) => stylist.id), !prior);
        if (input.resourceIds !== void 0) data.requiredResources = await many("SalonResource", input.resourceIds, (prior?.requiredResources || []).map((resource) => resource.id), !prior);
      } else if (kind === "category") {
        const name = text54(input.name, true);
        const slug = text54(input.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Category slug is invalid");
        const displayOrder = integer38(input.displayOrder ?? 0);
        const isVisible = input.isVisible === void 0 ? prior?.isVisible ?? true : input.isVisible;
        if (typeof isVisible !== "boolean") throw new Error("Category visibility must be boolean");
        data = { name, slug, description: text54(input.description), displayOrder, sortOrder: displayOrder, isVisible };
      }
      const record = prior ? await query[definition.list].updateOne({ where: { id: prior.id }, data, query: "id" }) : await query[definition.list].createOne({ data, query: "id" });
      await enqueueDomainEvent(tx, { eventKey, eventType: "salon.management.recorded.v1", aggregateType: kind, aggregateId: record.id, operation: prior ? "update" : "create", payload: { requestHash, fields: Object.keys(input), actorId: context.session.itemId } });
      return { success: true, recordId: record.id, error: null };
    });
  } catch (error) {
    return { ...denied10, error: error instanceof Error && SAFE_MANAGEMENT_ERRORS.has(error.message) ? error.message : "Record could not be saved; check uniqueness, selections, and active bookings before retrying." };
  }
}
var result = import_core82.graphql.object()({ name: "SalonManagementResult", fields: { success: import_core82.graphql.field({ type: import_core82.graphql.nonNull(import_core82.graphql.Boolean) }), recordId: import_core82.graphql.field({ type: import_core82.graphql.ID }), error: import_core82.graphql.field({ type: import_core82.graphql.String }) } });
var saveSalonRecord = import_core82.graphql.field({ type: result, args: { kind: import_core82.graphql.arg({ type: import_core82.graphql.nonNull(import_core82.graphql.String) }), id: import_core82.graphql.arg({ type: import_core82.graphql.ID }), input: import_core82.graphql.arg({ type: import_core82.graphql.nonNull(import_core82.graphql.JSON) }), idempotencyKey: import_core82.graphql.arg({ type: import_core82.graphql.nonNull(import_core82.graphql.String) }) }, resolve(_source, args, context) {
  return saveSalonRecordTransaction(context, args);
} });
var salonManagementWorkspace = import_core82.graphql.field({ type: import_core82.graphql.JSON, args: { kind: import_core82.graphql.arg({ type: import_core82.graphql.nonNull(import_core82.graphql.String) }) }, async resolve(_source, { kind }, context) {
  const definition = Object.hasOwn(config, kind) ? config[kind] : void 0;
  if (!definition || !definition.permission({ session: context.session })) throw new Error("Management access denied");
  const query = context.sudo().query;
  const canManageCompensation = permissions.canManageCommissions({ session: context.session });
  const selections = {
    client: "id user { name email phone } homeLocation { id }",
    staff: `id tier role status isActive user { name email phone } locations { id } specializations { id }${canManageCompensation ? " baseCommissionRate commissionRate" : ""}`,
    location: "id name address city state zipCode phone email timezone hours isActive",
    resource: "id name type capacity isActive location { id }",
    product: "id name sku price cost reorderPoint category description isActive",
    service: "id name description price basePrice baseDuration status category { id } specialists { id } requiredResources { id }",
    category: "id name slug description displayOrder sortOrder isVisible"
  };
  return {
    records: await query[definition.list].findMany({ take: 100, orderBy: { createdAt: "desc" }, query: selections[kind] }),
    canManageCompensation,
    locations: await query.Location.findMany({ take: 100, query: "id name isActive" }),
    services: await query.Service.findMany({ take: 100, query: "id name status" }),
    resources: await query.SalonResource.findMany({ take: 100, query: "id name isActive" }),
    stylists: await query.Stylist.findMany({ take: 100, query: "id status isActive user { name }" }),
    categories: await query.ServiceCategory.findMany({ take: 100, query: "id name isVisible" })
  };
} });

// features/keystone/extendGraphqlSchema/salonLocationStock.ts
var import_core83 = require("@keystone-6/core");

// features/keystone/inventory/locationStockRead.ts
async function readLocationStock(context, input) {
  const skip = input.skip ?? 0;
  const take = input.take ?? 30;
  const search = input.search?.trim() || "";
  if (!Number.isInteger(skip) || skip < 0 || skip > 2147483647 - take || !Number.isInteger(take) || take < 1 || take > 30 || search.length > 80 || Boolean(input.appointmentId) === Boolean(input.locationId)) throw new Error("Choose one stock scope and a bounded product page");
  const authorize = () => input.appointmentId ? assertCheckoutLocation(context, input.appointmentId) : assertStockLocation(context, input.locationId, "adjust");
  const scoped = await authorize();
  const products = await scoped.context.query.Product.findMany({
    where: { isActive: { equals: true }, ...search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {} },
    take: take + 1,
    skip,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    query: "id name sku price"
  });
  const page = products.slice(0, take);
  const balances = page.length ? await scoped.context.prisma.inventoryMovement.groupBy({
    by: ["productId"],
    where: { locationId: scoped.location.id, productId: { in: page.map((product) => product.id) } },
    _sum: { delta: true }
  }) : [];
  const quantities = /* @__PURE__ */ new Map();
  for (const row of balances) {
    if (!row.productId || !page.some((product) => product.id === row.productId) || quantities.has(row.productId) || !Number.isSafeInteger(row._sum.delta) || row._sum.delta < 0 || row._sum.delta > 2147483647) throw new Error("Location ledger requires reconciliation");
    quantities.set(row.productId, row._sum.delta);
  }
  const rechecked = await authorize();
  if (rechecked.location.id !== scoped.location.id) throw new Error("Stock location changed; reload before continuing");
  return {
    location: scoped.location,
    skip,
    take,
    hasMore: products.length > take,
    products: page.map((product) => {
      if (typeof product.name !== "string" || !Number.isSafeInteger(product.price) || product.price < 0) throw new Error("Product data could not be verified");
      return { id: product.id, name: product.name, sku: product.sku || null, price: product.price, localQuantity: quantities.get(product.id) ?? 0 };
    })
  };
}

// features/keystone/extendGraphqlSchema/salonLocationStock.ts
var salonLocationStock = import_core83.graphql.field({
  type: import_core83.graphql.JSON,
  args: {
    appointmentId: import_core83.graphql.arg({ type: import_core83.graphql.ID }),
    locationId: import_core83.graphql.arg({ type: import_core83.graphql.ID }),
    skip: import_core83.graphql.arg({ type: import_core83.graphql.Int }),
    take: import_core83.graphql.arg({ type: import_core83.graphql.Int }),
    search: import_core83.graphql.arg({ type: import_core83.graphql.String })
  },
  resolve(_source, args, context) {
    return readLocationStock(context, args);
  }
});

// features/keystone/mutations/index.ts
var gql = String.raw;
var extendGraphqlSchema = import_core84.graphql.extend((base) => ({
  query: {
    redirectToInit: import_core84.graphql.field({
      type: import_core84.graphql.Boolean,
      resolve: redirectToInit_default
    }),
    checkAvailability,
    calculateCommission,
    storefrontStylists,
    storefrontStylist,
    salonOperationsWorkspace,
    clientPortal,
    publicStorefrontSettings,
    salonManagementWorkspace,
    salonLocationStock
  },
  mutation: {
    registerSalonCustomer,
    bookAppointment,
    processPayment: paymentMutations.processPayment,
    confirmPayment: paymentMutations.confirmPayment,
    refundPayment: paymentMutations.refundPayment,
    distributeTip: paymentMutations.distributeTip,
    purchaseGiftCard: giftCardMutations.purchaseGiftCard,
    confirmGiftCardPurchase: giftCardMutations.confirmGiftCardPurchase,
    applyGiftCardBalance: giftCardMutations.applyGiftCardBalance,
    transitionAppointment,
    processAppointmentDeposit,
    redeemClientPackage,
    joinWaitlist,
    transitionWaitlistEntry,
    upsertStylistSchedule,
    setStylistScheduleAvailability,
    payoutCommissions,
    adjustSalonInventory,
    setSalonResourceAvailability,
    scheduleAppointmentSegments,
    transitionAppointmentSegment,
    reverseSalonTransaction,
    adjustSaleCompensation,
    publishConsultationTemplateVersion,
    submitConsultation,
    reviewConsultation,
    runSalonOnboarding,
    completeAppointmentCheckout,
    upsertSalonStoreSettings,
    saveSalonRecord
  }
}));

// features/keystone/index.ts
function requiredProductionValue(name, developmentFallback) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is required in production`);
  return developmentFallback;
}
var databaseURL = requiredProductionValue("DATABASE_URL", "file:./keystone.db");
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  // How long they stay signed in?
  secret: requiredProductionValue("SESSION_SECRET", "this secret should only be used in testing")
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
          canAccessDashboard: true,
          canManageSalon: true,
          canManageAppointments: true,
          canManageClients: true,
          canManageCareRecords: true,
          canManageCatalog: true,
          canManageSchedules: true,
          canManageOwnSchedule: true,
          canManageResources: true,
          canManageInventory: true,
          canManagePayments: true,
          canIssueRefunds: true,
          canManageCommissions: true,
          canViewReports: true,
          canManageIntegrations: true,
          canManageOnboarding: true
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
      canManageSalon
      canManageAppointments
      canManageClients
      canManageCareRecords
      canManageCatalog
      canManageSchedules
      canManageOwnSchedule
      canManageResources
      canManageInventory
      canManagePayments
      canIssueRefunds
      canManageCommissions
      canViewReports
      canManageIntegrations
      canManageOnboarding
    }
  `
});
var keystone_default = withAuth(
  (0, import_core85.config)({
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
