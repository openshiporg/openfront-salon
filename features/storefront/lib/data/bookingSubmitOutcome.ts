export type BookingSubmitOutcome =
  | { status: "accepted"; appointmentId: string }
  | { status: "rejected"; error: string }
  | { status: "unresolved" };

export interface BookingRequestKeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const BOOKING_REQUEST_KEY_STORAGE_KEY = "openfront-salon.booking-request-key";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_KEY_CONFLICT = "Booking request key was reused with different details";
const BOOKING_OUTCOME_UNRESOLVED = "Booking outcome could not be verified. Retry with the same request key.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Treat incomplete success and known idempotency conflicts as unresolved, never as a booking. */
export function resolveBookingSubmitOutcome(value: unknown): BookingSubmitOutcome {
  if (!isRecord(value) || typeof value.success !== "boolean") return { status: "unresolved" };
  if (value.success) {
    return typeof value.appointmentId === "string"
      && value.appointmentId.trim().length > 0
      && value.appointmentId === value.appointmentId.trim()
      && value.appointmentId.toLowerCase() !== "pending"
      ? { status: "accepted", appointmentId: value.appointmentId }
      : { status: "unresolved" };
  }
  if (typeof value.error !== "string" || !value.error.trim()) return { status: "unresolved" };
  if (value.error.includes(REQUEST_KEY_CONFLICT) || value.error.includes(BOOKING_OUTCOME_UNRESOLVED)) return { status: "unresolved" };
  return { status: "rejected", error: value.error };
}

/** Return a retry key only when this tab can persist and read it back across page reloads. */
export function getOrCreateBookingRequestKey(
  storage: BookingRequestKeyStorage,
  createKey: () => string,
): string | null {
  try {
    const existing = storage.getItem(BOOKING_REQUEST_KEY_STORAGE_KEY);
    if (existing && UUID_PATTERN.test(existing)) return existing;

    const requestKey = createKey();
    if (!UUID_PATTERN.test(requestKey)) return null;
    storage.setItem(BOOKING_REQUEST_KEY_STORAGE_KEY, requestKey);
    return storage.getItem(BOOKING_REQUEST_KEY_STORAGE_KEY) === requestKey ? requestKey : null;
  } catch {
    // An in-memory-only key would change after reload and could duplicate an ambiguous booking.
    return null;
  }
}

export function clearBookingRequestKey(storage: BookingRequestKeyStorage): void {
  try {
    storage.removeItem(BOOKING_REQUEST_KEY_STORAGE_KEY);
  } catch {
    // Failure to clear after confirmed success is safe: a later different payload will conflict, not duplicate.
  }
}
