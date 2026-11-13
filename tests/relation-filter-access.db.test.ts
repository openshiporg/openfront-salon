// Needs DATABASE_URL (scratch DB with migrations applied) and SESSION_SECRET.
// Run: DATABASE_URL=... SESSION_SECRET=... node --import tsx --test tests/relation-filter-access.db.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../features/keystone/index";

const ctx: any = getContext(config as any, PrismaModule as any);
const sudo = ctx.sudo();
const tag = Date.now().toString(36);
const PERMS = ["canSeeOtherPeople", "canEditOtherPeople", "canManagePeople", "canManageRoles", "canAccessDashboard", "canManageOnboarding", "canManageSalon", "canManageAppointments", "canManageClients", "canManageCareRecords", "canManageCatalog", "canManageSchedules", "canManageOwnSchedule", "canManageResources", "canManageInventory", "canManagePayments", "canIssueRefunds", "canManageCommissions", "canViewReports", "canManageIntegrations"];
const sessions: Record<string, any> = {};

async function actor(name: string, grants: string[]) {
  const role = await sudo.query.Role.createOne({ data: { name: `${name}-${tag}`, ...Object.fromEntries(grants.map((g) => [g, true])) }, query: "id" });
  const user = await sudo.query.User.createOne({ data: { name, email: `${name}-${tag}@example.com`, password: "a-long-test-password-1", role: { connect: { id: role.id } } }, query: "id" });
  return { itemId: user.id, listKey: "User", data: { name, role: { id: role.id, name: role.name, ...Object.fromEntries(PERMS.map((p) => [p, grants.includes(p)])) } } };
}

test("setup", async () => {
  const clientUser = await sudo.query.User.createOne({ data: { name: "Zed Client", email: `zed-${tag}@example.com`, password: "a-long-test-password-1" }, query: "id" });
  const client = await sudo.query.Client.createOne({ data: { user: { connect: { id: clientUser.id } }, notes: "alpha-secret", allergies: "alpha-allergy", guestEmail: `g-${tag}@example.com` }, query: "id" });
  const stylistUser = await sudo.query.User.createOne({ data: { name: "Sam Stylist", email: `sam-${tag}@example.com`, password: "a-long-test-password-1" }, query: "id" });
  const stylist = await sudo.query.Stylist.createOne({ data: { user: { connect: { id: stylistUser.id } }, baseCommissionRate: 0.42 }, query: "id" });
  const start = new Date("2030-01-01T10:00:00Z");
  await sudo.query.Appointment.createOne({ data: { client: { connect: { id: client.id } }, stylist: { connect: { id: stylist.id } }, startTime: start, endTime: new Date(start.getTime() + 3600000), duration: 60, internalNotes: "alpha-internal", notes: "alpha-note" }, query: "id" });
  await sudo.query.Product.createOne({ data: { name: `Prod ${tag}`, sku: `sku-${tag}`, price: 1000, cost: 400, isActive: true }, query: "id" });
  sessions.admin = await actor("admin", PERMS);
  sessions.stylist = await actor("stylist", ["canAccessDashboard", "canManageOwnSchedule"]);
  sessions.frontdesk = await actor("frontdesk", ["canAccessDashboard", "canManageAppointments", "canManageClients"]);
  sessions.accountant = await actor("accountant", ["canAccessDashboard", "canViewReports", "canManagePayments"]);
});

type Probe = { name: string; query: (hit: boolean) => string; allowedFor: string[] };
const swap = (hit: boolean, value: string) => (hit ? value : "q9z-none");
const sw = (h: boolean, v: string) => swap(h, v);
const probes: Probe[] = [
  { name: "clientsCount via notes", query: (h) => `{ n: clientsCount(where: { notes: { startsWith: "${sw(h, "alpha")}" } }) }`, allowedFor: ["admin"] },
  { name: "clientsCount via allergies", query: (h) => `{ n: clientsCount(where: { allergies: { startsWith: "${sw(h, "alpha")}" } }) }`, allowedFor: ["admin"] },
  { name: "clientsCount via user.email", query: (h) => `{ n: clientsCount(where: { user: { email: { startsWith: "${sw(h, "zed")}" } } }) }`, allowedFor: ["admin", "frontdesk"] },
  { name: "appointmentsCount via internalNotes", query: (h) => `{ n: appointmentsCount(where: { internalNotes: { startsWith: "${sw(h, "alpha")}" } }) }`, allowedFor: ["admin"] },
  { name: "appointmentsCount via client.notes", query: (h) => `{ n: appointmentsCount(where: { client: { notes: { startsWith: "${sw(h, "alpha")}" } } }) }`, allowedFor: ["admin"] },
  { name: "appointmentsCount via client.user.email", query: (h) => `{ n: appointmentsCount(where: { client: { user: { email: { startsWith: "${sw(h, "zed")}" } } } }) }`, allowedFor: ["admin", "frontdesk", "accountant"] },
  { name: "appointmentsCount via stylist.baseCommissionRate", query: (h) => `{ n: appointmentsCount(where: { stylist: { baseCommissionRate: { equals: ${h ? 0.42 : 0.99} } } }) }`, allowedFor: ["admin", "accountant"] },
  { name: "stylistsCount via baseCommissionRate", query: (h) => `{ n: stylistsCount(where: { baseCommissionRate: { equals: ${h ? 0.42 : 0.99} } }) }`, allowedFor: ["admin", "accountant"] },
  { name: "stylistsCount via user.email", query: (h) => `{ n: stylistsCount(where: { user: { email: { startsWith: "${sw(h, "sam")}" } } }) }`, allowedFor: ["admin"] },
  { name: "stylistsCount via appointments.some.internalNotes", query: (h) => `{ n: stylistsCount(where: { appointments: { some: { internalNotes: { startsWith: "${sw(h, "alpha")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "productsCount via cost", query: (h) => `{ n: productsCount(where: { cost: { equals: ${h ? 400 : 12345} } }) }`, allowedFor: ["admin", "accountant"] },
  { name: "usersCount via clientProfile.notes", query: (h) => `{ n: usersCount(where: { clientProfile: { notes: { startsWith: "${sw(h, "alpha")}" } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount via email", query: (h) => `{ n: usersCount(where: { email: { startsWith: "${sw(h, "zed")}" } }) }`, allowedFor: ["admin"] },
  { name: "usersCount via role.name", query: (h) => `{ n: usersCount(where: { role: { name: { startsWith: "${sw(h, "admin")}" } } }) }`, allowedFor: ["admin"] },
  { name: "rolesCount via assignedTo.some.email", query: (h) => `{ n: rolesCount(where: { assignedTo: { some: { email: { startsWith: "${sw(h, "admin")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount by password", query: (h) => `{ n: usersCount(where: { password: { isSet: ${h} } }) }`, allowedFor: [] },
  { name: "usersCount by passwordResetToken", query: (h) => `{ n: usersCount(where: { passwordResetToken: { isSet: ${h} } }) }`, allowedFor: [] },
  { name: "paymentSessionsCount via idempotencyKey", query: (h) => `{ n: paymentSessionsCount(where: { idempotencyKey: { startsWith: "${sw(h, "a")}" } }) }`, allowedFor: ["admin", "accountant"] },
  { name: "paymentsCount via appointment.client.notes", query: (h) => `{ n: paymentsCount(where: { appointment: { client: { notes: { startsWith: "${sw(h, "alpha")}" } } } }) }`, allowedFor: ["admin"] },
];

// Signed out and each limited role: a hit and a miss must give the same count, or an access error.
for (const who of ["anonymous", "stylist", "frontdesk", "accountant"]) {
  for (const probe of probes) {
    test(`${who}: ${probe.name}`, async () => {
      const c = who === "anonymous" ? ctx : ctx.withSession(sessions[who]);
      const run = async (hit: boolean) => {
        const r = await c.graphql.raw({ query: probe.query(hit) });
        return r.errors?.length ? "error" : r.data?.n;
      };
      const [hit, miss] = [await run(true), await run(false)];
      if (!probe.allowedFor.includes(who)) assert.equal(hit, miss, `${probe.name} leaks for ${who}: hit=${hit} miss=${miss}`);
    });
  }
}

test("admin keeps its real filters", async () => {
  const c = ctx.withSession(sessions.admin);
  const count = async (where: string) => (await c.graphql.raw({ query: `{ n: appointmentsCount(where: ${where}) }` })).data?.n;
  assert.ok((await count(`{ client: { notes: { startsWith: "alpha" } } }`)) >= 1);
  assert.equal(await count(`{ client: { notes: { startsWith: "q9z-none" } } }`), 0);
});

test("password and reset tokens are never filterable, even for admin", async () => {
  const c = ctx.withSession(sessions.admin);
  for (const f of ["password", "passwordResetToken"]) {
    const r = await c.graphql.raw({ query: `{ n: usersCount(where: { ${f}: { isSet: true } }) }` });
    assert.ok(r.errors?.length, `${f} filter must be refused`);
  }
});
