import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { DELETE_HISTORY, deleteHistoryProblem } from "../features/keystone/lib/deleteHistoryGuard";

test("every delete-history reference is a real foreign key to that parent", () => {
  const models = Prisma.dmmf.datamodel.models;
  for (const [parent, rule] of Object.entries(DELETE_HISTORY)) {
    for (const ref of rule.references) {
      const model = models.find((m) => m.name[0].toLowerCase() + m.name.slice(1) === ref.model);
      const relation = model?.fields.find((f) => f.kind === "object" && f.relationFromFields?.[0] === ref.field);
      assert.equal(relation?.type, parent, `${ref.model}.${ref.field} points at ${parent}`);
    }
  }
});

const prismaWith = (counts: Record<string, number>) =>
  new Proxy({}, { get: (_t, model: string) => ({ count: async () => counts[model] || 0 }) });

test("plans, packages, templates and roles in use can't be deleted; unused ones can", async () => {
  assert.equal(await deleteHistoryProblem(prismaWith({ clientMembership: 1 }), "Membership", "m"), "This is used by 1 client membership. Turn off Active instead so nobody new can join.");
  assert.equal(await deleteHistoryProblem(prismaWith({ clientPackage: 3 }), "ServicePackage", "p"), "This is used by 3 sold packages. Turn off Active instead so it is no longer sold.");
  assert.equal(await deleteHistoryProblem(prismaWith({ user: 2 }), "Role", "r"), "2 people still have this role. Give them another role first.");
  assert.equal(await deleteHistoryProblem(prismaWith({}), "Membership", "m"), null);
});

test("points balances change only through the ledger workflows", () => {
  const source = readFileSync(new URL("../features/keystone/models/ClientPoints.ts", import.meta.url), "utf8");
  for (const op of ["create", "update", "delete"]) assert.match(source, new RegExp(`${op}: \\(\\) => false`));
});

test("the migration backs refunds, gift card balance, package value and appointment times", () => {
  const sql = readFileSync(new URL("../migrations/20261107150000_salon_money_relations_and_times/migration.sql", import.meta.url), "utf8");
  for (const name of ["Payment_refund_within_total", "GiftCard_balance_within_initial", "ClientPackage_value_range", "ClientPoints_client_key", "Appointment_time_and_deposit_check"]) assert.ok(sql.includes(name), name);
  assert.match(sql, /RAISE EXCEPTION/);
});
