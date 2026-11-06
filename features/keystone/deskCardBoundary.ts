import type { Context } from ".keystone/types";

const OPEN = ["pending", "requires_action", "authorized"];

/** Front-desk card attempts for a visit, newest first. They hold the visit id in data so they never block deposit rules. */
export async function deskCardSessions(context: Context, appointmentId: string) {
  return context.prisma.paymentSession.findMany({
    where: { data: { path: ["deskAppointmentId"], equals: appointmentId } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, status: true, amount: true, data: true, providerReference: true, createdAt: true },
  });
}

/** Cash or terminal checkout must not run while a card page is open or a taken card is not yet recorded. */
export async function assertNoOpenDeskCard(context: Context, appointmentId: string) {
  for (const row of await deskCardSessions(context, appointmentId)) {
    const data = (row.data || {}) as Record<string, unknown>;
    if (OPEN.includes(row.status)) throw new Error("A card payment is open for this visit. Finish or cancel it first.");
    if (row.status === "completed" && !data.settledSessionId) throw new Error("A card payment was taken for this visit. Record it from the card panel.");
  }
}
