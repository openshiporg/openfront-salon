export type BookingSelectionRead<T> =
  | { status: "available"; items: T[] }
  | { status: "unavailable" };

export type BookingContextData = {
  locations: { id: string; name: string; timezone: string | null }[];
  client: { id: string; name: string; email: string; phone: string | null } | null;
  policy: { version: string; cancellationNoticeMinutes: number; rescheduleNoticeMinutes: number };
};

export type BookingContextRead =
  | { status: "available"; data: BookingContextData }
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPublicImage(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)
    || !nullableString(value.imagePath)
    || !nullableString(value.altText)) return false;
  return value.image === null || (isRecord(value.image) && typeof value.image.url === "string" && value.image.url.length > 0);
}

function isStylistSchedule(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === "string" && value.id.length > 0
    && (value.dayOfWeek === null || (Number.isInteger(value.dayOfWeek) && Number(value.dayOfWeek) >= 0 && Number(value.dayOfWeek) <= 6))
    && typeof value.startTime === "string"
    && typeof value.endTime === "string"
    && typeof value.isAvailable === "boolean";
}

/** A selection result is trusted only when the whole list and every row have the expected shape. */
export function resolveBookingSelectionRead<T>(
  success: boolean,
  value: unknown,
  isValidItem: (item: unknown) => item is T,
): BookingSelectionRead<T> {
  if (!success || !Array.isArray(value) || !Array.from(value).every(isValidItem)) return { status: "unavailable" };
  return { status: "available", items: value };
}

export function isBookableServiceSelection(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === "string" && value.id.length > 0
    && typeof value.name === "string" && value.name.trim().length > 0
    && value.status === "active"
    && nullableString(value.description)
    && typeof value.baseDuration === "number" && Number.isInteger(value.baseDuration) && value.baseDuration > 0
    && typeof value.basePrice === "number" && Number.isInteger(value.basePrice) && value.basePrice >= 0
    && value.requiresConsultation === false
    && value.requiresPatchTest === false
    && (value.category === null || (isRecord(value.category) && typeof value.category.id === "string" && typeof value.category.name === "string"))
    && isPublicImage(value.image);
}

export function isQualifiedStylistSelection(value: unknown, serviceId: string): boolean {
  if (!isRecord(value)
    || typeof value.id !== "string" || !value.id
    || value.isActive !== true
    || !(value.tier === null || ["junior", "senior", "master", "celebrity"].includes(String(value.tier)))
    || (value.bio !== null && typeof value.bio !== "string")
    || (value.user !== null && (!isRecord(value.user) || typeof value.user.id !== "string" || typeof value.user.name !== "string"))
    || !isPublicImage(value.photo)
    || !Array.isArray(value.specializations)
    || !Array.from(value.specializations).every((specialization) =>
      isRecord(specialization) && typeof specialization.id === "string" && typeof specialization.name === "string",
    )
    || !Array.isArray(value.schedules)
    || !Array.from(value.schedules).every(isStylistSchedule)) return false;

  return value.specializations.some((specialization) => specialization.id === serviceId);
}

export function resolveBookingContextRead(
  success: boolean,
  value: unknown,
  policy: BookingContextData["policy"],
): BookingContextRead {
  if (!success || !isRecord(value)
    || !Array.isArray(value.locations)
    || !Array.from(value.locations).every((location) =>
      isRecord(location)
      && typeof location.id === "string" && location.id.length > 0
      && typeof location.name === "string" && location.name.length > 0
      && nullableString(location.timezone),
    )
    || !Object.prototype.hasOwnProperty.call(value, "authenticatedItem")) return { status: "unavailable" };

  const client = value.authenticatedItem;
  if (client !== null && (!isRecord(client)
    || typeof client.id !== "string" || !client.id
    || typeof client.name !== "string"
    || typeof client.email !== "string"
    || !nullableString(client.phone))) return { status: "unavailable" };

  if (!policy || typeof policy.version !== "string" || !policy.version
    || ![policy.cancellationNoticeMinutes, policy.rescheduleNoticeMinutes].every((minutes) =>
      Number.isInteger(minutes) && minutes >= 0 && minutes <= 525600,
    )) return { status: "unavailable" };

  return {
    status: "available",
    data: {
      locations: value.locations as BookingContextData["locations"],
      client: client as BookingContextData["client"],
      policy,
    },
  };
}
