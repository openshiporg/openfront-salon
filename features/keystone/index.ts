import { createAuth } from "@keystone-6/auth";
import { config } from "@keystone-6/core";
import "dotenv/config";
import { models } from "./models";
import { statelessSessions } from "@keystone-6/core/session";
import { extendGraphqlSchema } from "./mutations";
import { sendPasswordResetEmail } from "./lib/mail";
import { permissions } from "./access";
import { withFilterAccess } from "./filterAccess";
import { s3ForcePathStyle } from "./lib/s3-storage";
import { pooledDatabaseUrl } from './database-url';
import { throwKeystonePrismaErrors } from './lib/keystonePrismaErrors';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function productionEnv(name: string, developmentFallback: string): string {
  if (process.env[name]) return process.env[name]!;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}

const databaseURL = requiredEnv("DATABASE_URL");
const sessionSecret = requiredEnv("SESSION_SECRET");
if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters long");
}

export const basePath = "/dashboard";

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 360, // How long they stay signed in?
  secret: sessionSecret,
};

const bucketName = productionEnv("S3_BUCKET_NAME", "keystone-test");
const region = productionEnv("S3_REGION", "ap-southeast-2");
const accessKeyId = productionEnv("S3_ACCESS_KEY_ID", "keystone");
const secretAccessKey = productionEnv("S3_SECRET_ACCESS_KEY", "keystone");
const endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      role: {
        create: {
          name: "Admin",
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
          canManageOnboarding: true,
        },
      },
    },
  },
  passwordResetLink: {
    async sendToken(args) {
      // send the email
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
  sessionData: `
    name
    email
    role {
      id
      name
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
  `,
});

/** Lists a session cannot create in or read are hidden from it, by the same operation access the server enforces. */
function withPermissionUi(lists: Record<string, any>) {
  return Object.fromEntries(Object.entries(lists).map(([key, list]) => {
    const operation = list?.access?.operation;
    if (!operation || typeof operation !== "object") return [key, list];
    const allowed = (name: "create" | "query") => (args: any) => {
      const rule = operation[name];
      return typeof rule === "function" ? Boolean(rule({ ...args, operation: name, listKey: key })) : rule !== false;
    };
    const ui = list.ui ?? {};
    return [key, { ...list, ui: {
      ...ui,
      hideCreate: ui.hideCreate ?? ((args: any) => !allowed("create")(args)),
      isHidden: ui.isHidden ?? ((args: any) => !allowed("query")(args)),
    } }];
  }));
}

const authedConfig = withAuth(
  config({
    db: {
      provider: "postgresql",
      url: pooledDatabaseUrl(databaseURL),
      // Keystone returns failed queries as values; this makes them throw so transactions roll back.
      extendPrismaClient: throwKeystonePrismaErrors,
    },
    lists: withPermissionUi(models),
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5000 },
        forcePathStyle: s3ForcePathStyle(endpoint),
      },
    },
    ui: {
      isAccessAllowed: ({ session }) => permissions.canAccessDashboard({ session }),
      basePath,
    },
    session: statelessSessions(sessionConfig),
    graphql: {
      extendGraphqlSchema,
    },
  })
);

// Applied after withAuth so the auth-added fields (reset tokens) are covered too.
export default { ...authedConfig, lists: withFilterAccess(authedConfig.lists as Record<string, any>) } as typeof authedConfig;
