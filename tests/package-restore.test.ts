import assert from "node:assert/strict";
import test from "node:test";
import { packageStatusAfterRestore } from "../features/keystone/mutations/reversalWorkflows";

test("restoring value reopens a fully-used package", () => {
  assert.equal(packageStatusAfterRestore("fully-used"), "active");
  assert.equal(packageStatusAfterRestore("active"), "active");
});
test("restoring value never revives a cancelled or expired package", () => {
  assert.equal(packageStatusAfterRestore("cancelled"), "cancelled");
  assert.equal(packageStatusAfterRestore("expired"), "expired");
});
