const appointmentStatuses = new Set([
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export type ClientPortalReadResult =
  | { status: "unavailable" }
  | { status: "unauthenticated" }
  | { status: "available"; portal: Record<string, unknown> & { appointments: unknown[]; availableForms: unknown[] } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAppointmentLineItem(value: unknown): boolean {
  return isRecord(value) && typeof value.serviceTitle === "string";
}

function isReceiptLineItem(value: unknown): boolean {
  return isRecord(value)
    && (value.itemType === "service" || value.itemType === "product")
    && [value.quantity, value.unitPrice, value.discount].every(Number.isFinite);
}

function isAppointment(value: unknown): boolean {
  if (!isRecord(value)
    || typeof value.id !== "string" || !value.id
    || typeof value.startTime !== "string" || !Number.isFinite(Date.parse(value.startTime))
    || typeof value.status !== "string" || !appointmentStatuses.has(value.status)
    || !Array.isArray(value.lineItems) || !value.lineItems.every(isAppointmentLineItem)
    || !Array.isArray(value.segments) || !value.segments.every(isRecord)
    || !Array.isArray(value.scheduleRevisions)
    || !isRecord(value.metadata) || !Array.isArray(value.metadata.transitionHistory)) return false;

  if (value.metadata.clientPolicySnapshot !== null && !isRecord(value.metadata.clientPolicySnapshot)) return false;
  if (value.transaction !== null && (!isRecord(value.transaction)
    || !Array.isArray(value.transaction.lineItems) || !value.transaction.lineItems.every(isReceiptLineItem))) return false;
  if (value.payment !== null && !isRecord(value.payment)) return false;
  if (value.location !== null && !isRecord(value.location)) return false;
  if (value.stylist !== null && !isRecord(value.stylist)) return false;
  return true;
}

function isAvailableForm(value: unknown): boolean {
  if (!isRecord(value)
    || typeof value.id !== "string" || !value.id
    || typeof value.version !== "string"
    || typeof value.titleSnapshot !== "string"
    || typeof value.purposeSnapshot !== "string"
    || typeof value.questionsHash !== "string"
    || typeof value.documentHash !== "string"
    || !Array.isArray(value.questions)) return false;

  return value.questions.every((question) =>
    isRecord(question)
    && question.id !== undefined && question.id !== null && String(question.id).length > 0
    && typeof question.label === "string",
  );
}

/** Fail closed on query errors and incomplete JSON projections; never carry partial client data into the UI. */
export function resolveClientPortalRead(success: boolean, value: unknown): ClientPortalReadResult {
  if (!success || !isRecord(value)) return { status: "unavailable" };
  if (value.authenticated === false) return { status: "unauthenticated" };
  if (value.authenticated !== true
    || !Object.prototype.hasOwnProperty.call(value, "client")
    || (value.client !== null && !isRecord(value.client))
    || !Array.isArray(value.appointments)
    || !value.appointments.every(isAppointment)
    || !Array.isArray(value.availableForms)
    || !value.availableForms.every(isAvailableForm)) return { status: "unavailable" };

  return {
    status: "available",
    portal: value as Record<string, unknown> & { appointments: unknown[]; availableForms: unknown[] },
  };
}
