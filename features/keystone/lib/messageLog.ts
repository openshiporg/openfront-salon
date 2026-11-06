import type { Context } from ".keystone/types";

export type MessageKind = "appointment_confirmation" | "appointment_reminder" | "appointment_cancelled" | "appointment_rescheduled" | "gift_card" | "membership";

/**
 * Sends one email and writes the outcome to MessageLog, so Engagement shows what each client was actually sent
 * and which deliveries failed. Logging never blocks or fails the send itself.
 */
export async function sendLogged(context: Context, input: { to: string; kind: MessageKind; subject: string; send: () => Promise<unknown> }) {
  let error: unknown = null;
  try { await input.send(); } catch (caught) { error = caught; }
  try {
    const user = (await context.sudo().query.User.findMany({ where: { email: { equals: input.to, mode: "insensitive" } }, take: 1, query: "id" }))[0];
    await context.sudo().query.MessageLog.createOne({
      data: {
        channel: "email", status: error ? "failed" : "sent", kind: input.kind, subject: input.subject.slice(0, 200),
        recipientAddress: input.to, errorMessage: error ? String((error as Error)?.message || error).slice(0, 500) : "",
        ...(user ? { recipient: { connect: { id: user.id } } } : {}),
      },
      query: "id",
    });
  } catch (logError) {
    console.error("Message log write failed:", logError);
  }
  if (error) throw error;
}
