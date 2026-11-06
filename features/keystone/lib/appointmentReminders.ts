import type { Context } from ".keystone/types";
import { appointmentEmailSubject, mailConfigured, sendAppointmentConfirmation } from "./mail";
import { sendLogged } from "./messageLog";
import { getStorefrontMessageBrand } from "./storefrontBranding";

/**
 * Day-ahead reminders (Mindbody / Boulevard default: ~24h before). The salon has no scheduler, so the sweep rides
 * ordinary traffic (storefront availability, dashboard calendar), at most every few minutes per server, and every
 * appointment is claimed exactly once through reminderSentAt before the email goes out.
 */
const WINDOW_START_MS = 20 * 3600_000;
const WINDOW_END_MS = 28 * 3600_000;
const MIN_INTERVAL_MS = 5 * 60_000;
let lastSweep = 0;

export function triggerReminderSweep(context: Context) {
  const now = Date.now();
  if (now - lastSweep < MIN_INTERVAL_MS || process.env.NODE_ENV === "test") return;
  lastSweep = now;
  void sendDueReminders(context, new Date(now)).catch((error) => console.error("Reminder sweep failed:", error));
}

export async function sendDueReminders(context: Context, now = new Date()) {
  if (!(await mailConfigured())) return 0;
  const prisma = context.prisma;
  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ["pending", "confirmed"] },
      reminderSentAt: null,
      startTime: { gte: new Date(now.getTime() + WINDOW_START_MS), lt: new Date(now.getTime() + WINDOW_END_MS) },
    },
    take: 25,
    select: {
      id: true, startTime: true, duration: true,
      client: { select: { guestName: true, guestEmail: true, user: { select: { name: true, email: true } } } },
      stylist: { select: { user: { select: { name: true } } } },
      services: { select: { name: true, price: true } },
      location: { select: { timezone: true } },
    },
  });
  if (!due.length) return 0;
  const brand = await getStorefrontMessageBrand(context);
  const store = process.env.SMTP_STORE_LINK?.replace(/\/$/, "") || "";
  let sent = 0;
  for (const visit of due) {
    const to = (visit.client?.user?.email || visit.client?.guestEmail || "").trim();
    if (!to) continue;
    const claimed = await prisma.appointment.updateMany({ where: { id: visit.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    const timeZone = visit.location?.timezone || "America/New_York";
    const params = {
      to,
      clientName: visit.client?.user?.name || visit.client?.guestName || "there",
      serviceName: visit.services.map((service) => service.name).join(", ") || "Appointment",
      stylistName: visit.stylist?.user?.name || "your stylist",
      appointmentDate: visit.startTime.toLocaleDateString("en-US", { timeZone, weekday: "long", month: "long", day: "numeric" }),
      appointmentTime: visit.startTime.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }),
      duration: visit.duration || 60,
      price: visit.services.reduce((sum, service) => sum + Number(service.price || 0), 0) / 100,
      storefrontName: brand.name,
      themeHue: brand.themeHue,
      reminder: true,
      manageUrl: visit.client?.user && store ? `${store}/appointments` : null,
    };
    try {
      await sendLogged(context, { to, kind: "appointment_reminder", subject: await appointmentEmailSubject(params), send: () => sendAppointmentConfirmation(params) });
      sent += 1;
    } catch {
      // Mail failed (and was logged): release the claim so a later sweep can retry inside the window.
      await prisma.appointment.updateMany({ where: { id: visit.id, reminderSentAt: now }, data: { reminderSentAt: null } }).catch(() => undefined);
    }
  }
  return sent;
}
