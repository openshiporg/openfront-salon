import type { Context } from ".keystone/types";
import { mailConfigured, sendAppointmentNoticeEmail } from "./mail";
import { sendLogged } from "./messageLog";
import { getStorefrontMessageBrand } from "./storefrontBranding";

/**
 * Consumes the DomainEvent outbox. Every booking, sale and edit is recorded there; this dispatcher delivers each
 * event exactly once to its subscribers and marks it delivered:
 *  - appointment cancelled  → "Your appointment was cancelled" email to the client (Mindbody / Boulevard default)
 *  - appointment moved      → "Your appointment moved" email with the new time
 *  - everything else        → no external subscriber; delivered to the audit log
 * Client emails go out through the configured SMTP provider and are written to MessageLog. Without SMTP the event is
 * still delivered (to the log) with a note, so nothing sits in the queue. Failures retry with backoff and
 * dead-letter after MAX_ATTEMPTS, which is the only state Integrations raises as an exception.
 *
 * The salon has no scheduler, so the sweep rides ordinary traffic (storefront and dashboard reads), at most once a
 * minute per server; rows are claimed pending → processing so two servers never deliver the same event.
 */
const BATCH = 100;
const MAX_ATTEMPTS = 5;
const MIN_INTERVAL_MS = 60_000;
const STALE_PROCESSING_MS = 10 * 60_000;
/** Notices for changes older than this are history: delivered to the log, not emailed late. */
const NOTICE_FRESH_MS = 6 * 3600_000;
let lastSweep = 0;
let running = false;

type Snapshot = Record<string, unknown> | null;
type Payload = { aggregateType?: string; aggregateId?: string; operation?: string; before?: Snapshot; after?: Snapshot };
type OutboxEvent = { id: string; eventType: string; aggregateId: string; payload: unknown; occurredAt: Date; attempts: number };
export type DeliveryOutcome = { kind: "notice"; notice: "cancelled" | "rescheduled" } | { kind: "log" };

export function triggerOutboxSweep(context: Context) {
  const now = Date.now();
  if (running || now - lastSweep < MIN_INTERVAL_MS || process.env.NODE_ENV === "test") return;
  lastSweep = now;
  running = true;
  void deliverPendingEvents(context, new Date(now))
    .catch((error) => console.error("Outbox sweep failed:", error))
    .finally(() => { running = false; });
}

/**
 * After a write that a client should hear about (appointment cancelled or moved): deliver shortly after the
 * transaction commits instead of waiting for the next traffic sweep. Lifecycle hooks run inside the write's
 * transaction, so the delivery is deferred a moment; if it runs early the next sweep still picks the event up.
 */
export function kickOutboxSoon(context: Context, delayMs = 2_000) {
  if (process.env.NODE_ENV === "test") return;
  setTimeout(() => {
    if (running) return;
    running = true;
    lastSweep = Date.now();
    void deliverPendingEvents(context.sudo() as Context)
      .catch((error) => console.error("Outbox delivery failed:", error))
      .finally(() => { running = false; });
  }, delayMs).unref?.();
}

/** Which subscriber an event goes to. Pure, so it is unit-tested without a database. */
export function routeDomainEvent(event: { eventType: string; payload: unknown; occurredAt: Date }, now: Date): DeliveryOutcome {
  if (event.eventType !== "salon.appointment.update.v1") return { kind: "log" };
  const payload = (event.payload || {}) as Payload;
  const before = payload.before || {};
  const after = payload.after || {};
  if (now.getTime() - new Date(event.occurredAt).getTime() > NOTICE_FRESH_MS) return { kind: "log" };
  const startsAt = after.startTime ? new Date(String(after.startTime)) : null;
  if (!startsAt || startsAt.getTime() < now.getTime()) return { kind: "log" };
  if (after.status === "cancelled" && before.status !== "cancelled") return { kind: "notice", notice: "cancelled" };
  const active = ["pending", "confirmed"].includes(String(after.status));
  if (active && before.startTime && after.startTime && String(before.startTime) !== String(after.startTime)) return { kind: "notice", notice: "rescheduled" };
  return { kind: "log" };
}

export function retryDelayMs(attempts: number) {
  return Math.min(60, 2 ** attempts) * 60_000;
}

async function sendNotice(context: Context, appointmentId: string, notice: "cancelled" | "rescheduled") {
  const visit = await context.prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, startTime: true, status: true, cancellationReason: true,
      client: { select: { guestName: true, guestEmail: true, user: { select: { name: true, email: true } } } },
      stylist: { select: { user: { select: { name: true } } } },
      services: { select: { name: true } },
      location: { select: { name: true, timezone: true } },
    },
  });
  if (!visit) return "appointment no longer exists";
  // The appointment may have changed again since; only send what is still true.
  if (notice === "cancelled" && visit.status !== "cancelled") return "no longer cancelled";
  if (notice === "rescheduled" && !["pending", "confirmed"].includes(String(visit.status))) return "no longer active";
  const to = (visit.client?.user?.email || visit.client?.guestEmail || "").trim();
  if (!to) return "client has no email";
  if (!(await mailConfigured())) return "email not configured; recorded to log";
  const brand = await getStorefrontMessageBrand(context);
  const store = process.env.SMTP_STORE_LINK?.replace(/\/$/, "") || "";
  const timeZone = visit.location?.timezone || "America/New_York";
  const when = visit.startTime ? `${visit.startTime.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" })} at ${visit.startTime.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })}` : "";
  const rows: Array<[string, string]> = [
    ["Service", visit.services.map((service) => service.name).join(", ") || "Appointment"],
    ["With", visit.stylist?.user?.name || "your stylist"],
    [notice === "cancelled" ? "Was" : "New time", when],
    ...(visit.location?.name ? [["Where", visit.location.name] as [string, string]] : []),
  ];
  const subject = notice === "cancelled" ? `Cancelled: ${when}${brand.name ? ` · ${brand.name}` : ""}` : `Moved to ${when}${brand.name ? ` · ${brand.name}` : ""}`;
  await sendLogged(context, {
    to,
    kind: notice === "cancelled" ? "appointment_cancelled" : "appointment_rescheduled",
    subject,
    send: () => sendAppointmentNoticeEmail({
      to, subject,
      heading: notice === "cancelled" ? "Appointment cancelled" : "Appointment moved",
      clientName: visit.client?.user?.name || visit.client?.guestName || "there",
      body: notice === "cancelled" ? "Your appointment has been cancelled. We'd love to see you another time." : "Your appointment has a new time. Everything else stays the same.",
      rows,
      storefrontName: brand.name, themeHue: brand.themeHue,
      actionUrl: store ? (notice === "cancelled" ? `${store}/book` : visit.client?.user ? `${store}/appointments` : null) : null,
      actionLabel: notice === "cancelled" ? "Book again" : "See your appointment",
    }),
  });
  return null;
}

async function deliverOne(context: Context, event: OutboxEvent, now: Date) {
  const route = routeDomainEvent(event, now);
  const note = route.kind === "notice" ? await sendNotice(context, event.aggregateId, route.notice) : null;
  return note;
}

export async function deliverPendingEvents(context: Context, now = new Date()) {
  const prisma = context.prisma;
  // Rows a crashed server left mid-delivery go back to the queue.
  await prisma.domainEvent.updateMany({ where: { status: "processing", updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) } }, data: { status: "pending" } });
  let delivered = 0;
  for (let round = 0; round < 10; round += 1) {
    const batch = await prisma.domainEvent.findMany({
      where: { status: "pending", availableAt: { lte: now } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take: BATCH,
      select: { id: true, eventType: true, aggregateId: true, payload: true, occurredAt: true, attempts: true },
    });
    if (!batch.length) break;
    for (const event of batch) {
      const claimed = await prisma.domainEvent.updateMany({ where: { id: event.id, status: "pending" }, data: { status: "processing" } });
      if (!claimed.count) continue;
      try {
        const note = await deliverOne(context, event as OutboxEvent, now);
        await prisma.domainEvent.update({ where: { id: event.id }, data: { status: "delivered", deliveredAt: new Date(), attempts: event.attempts + 1, lastError: note || "" } });
        delivered += 1;
      } catch (error) {
        const attempts = event.attempts + 1;
        const message = String((error as Error)?.message || error).slice(0, 500);
        await prisma.domainEvent.update({
          where: { id: event.id },
          data: attempts >= MAX_ATTEMPTS
            ? { status: "dead_letter", attempts, lastError: message }
            : { status: "pending", attempts, lastError: message, availableAt: new Date(now.getTime() + retryDelayMs(attempts)) },
        });
      }
    }
    if (batch.length < BATCH) break;
  }
  return delivered;
}
