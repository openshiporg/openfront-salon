import test from "node:test";
import assert from "node:assert/strict";
import { retryDelayMs, routeDomainEvent } from "../features/keystone/lib/domainOutbox";

const now = new Date("2026-11-06T12:00:00Z");
const later = "2026-11-08T15:00:00.000Z";
const event = (before: Record<string, unknown>, after: Record<string, unknown>, eventType = "salon.appointment.update.v1", occurredAt = now) => ({ eventType, occurredAt, payload: { before, after } });

test("a fresh cancellation of a future appointment emails the client", () => {
  assert.deepEqual(routeDomainEvent(event({ status: "confirmed", startTime: later }, { status: "cancelled", startTime: later }), now), { kind: "notice", notice: "cancelled" });
});

test("a moved appointment emails the new time", () => {
  assert.deepEqual(routeDomainEvent(event({ status: "confirmed", startTime: later }, { status: "confirmed", startTime: "2026-11-09T15:00:00.000Z" }), now), { kind: "notice", notice: "rescheduled" });
});

test("other events, past appointments and stale backlog go to the audit log only", () => {
  assert.deepEqual(routeDomainEvent(event({}, { status: "confirmed" }, "salon.payment.create.v1"), now), { kind: "log" });
  assert.deepEqual(routeDomainEvent(event({ status: "confirmed", startTime: "2026-11-01T15:00:00.000Z" }, { status: "cancelled", startTime: "2026-11-01T15:00:00.000Z" }), now), { kind: "log" });
  assert.deepEqual(routeDomainEvent(event({ status: "confirmed", startTime: later }, { status: "cancelled", startTime: later }, undefined, new Date("2026-11-01T00:00:00Z")), now), { kind: "log" });
  assert.deepEqual(routeDomainEvent(event({ status: "confirmed", startTime: later }, { status: "completed", startTime: later }), now), { kind: "log" });
});

test("retries back off and cap at an hour", () => {
  assert.equal(retryDelayMs(1), 2 * 60_000);
  assert.equal(retryDelayMs(10), 60 * 60_000);
});
