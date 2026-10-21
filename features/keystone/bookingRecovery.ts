import type { Context } from ".keystone/types";

export type BookingRecoveryResult =
  | { status: "accepted"; appointmentId: string }
  | { status: "conflict" }
  | { status: "absent" }
  | { status: "unresolved" };

export const BOOKING_RECOVERY_DELAYS_MS = [0, 50, 150] as const;
export const BOOKING_REQUEST_KEY_CONFLICT = "Booking request key was reused with different details";
export const BOOKING_OUTCOME_UNRESOLVED = "Booking outcome could not be verified. Retry with the same request key.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function classifyBookingRecoveryRecord(record: unknown, requestHash: string): BookingRecoveryResult {
  if (record === null) return { status: "absent" };
  if (!isRecord(record)
    || typeof record.id !== "string" || !record.id.trim() || record.id !== record.id.trim()
    || !isRecord(record.metadata)
    || typeof record.metadata.bookingRequestHash !== "string") return { status: "unresolved" };
  return record.metadata.bookingRequestHash === requestHash
    ? { status: "accepted", appointmentId: record.id }
    : { status: "conflict" };
}

/**
 * Resolve a possibly committed booking using only its actor-scoped opaque key.
 * The transaction takes the same advisory lock as the write before checking
 * metadata, so another request with that key cannot be between lookup and commit.
 */
export async function recoverBookingByIdempotency(
  context: Context,
  requestKey: string,
  requestHash: string,
  delaysMs: readonly number[] = BOOKING_RECOVERY_DELAYS_MS,
): Promise<BookingRecoveryResult> {
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
          requestKey,
        );
        return transactionContext.prisma.appointment.findFirst({
          where: { metadata: { path: ["bookingRequestKey"], equals: requestKey } },
          select: { id: true, metadata: true },
        });
      }, { maxWait: 5_000, timeout: 5_000 });
      const result = classifyBookingRecoveryRecord(record, requestHash);
      if (result.status !== "absent") return result;
      successfulAbsentReads += 1;
    } catch {
      // A failed reconciliation read cannot prove that the write did not commit.
    }
  }

  return successfulAbsentReads === attempts.length
    ? { status: "absent" }
    : { status: "unresolved" };
}
