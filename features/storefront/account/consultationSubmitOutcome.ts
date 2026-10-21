export type ConsultationRetryAttempt = {
  templateVersionId: string;
  idempotencyKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A submission is acknowledged only with its immutable record ID and SHA-256 evidence hash. */
export function isVerifiedConsultationResponse(responseSuccess: boolean, value: unknown): boolean {
  return responseSuccess
    && isRecord(value)
    && value.success === true
    && typeof value.recordId === "string"
    && value.recordId.length > 0
    && value.recordId.toLowerCase() !== "pending"
    && value.recordId === value.recordId.trim()
    && typeof value.evidenceHash === "string"
    && /^[0-9a-f]{64}$/i.test(value.evidenceHash);
}

/** Validate the opaque attempt identity preserved through an ambiguous redirect. */
export function parseConsultationRetryAttempt(
  outcome: unknown,
  templateVersionId: unknown,
  idempotencyKey: unknown,
): ConsultationRetryAttempt | null {
  if (outcome !== "unresolved"
    || typeof templateVersionId !== "string" || !templateVersionId.trim() || templateVersionId.length > 128
    || typeof idempotencyKey !== "string" || idempotencyKey.length > 200) return null;

  const prefix = `portal-consultation:${templateVersionId}:`;
  if (!idempotencyKey.startsWith(prefix)) return null;
  const nonce = idempotencyKey.slice(prefix.length);
  const isTimestampNonce = /^\d{10,16}$/.test(nonce);
  const isUuidNonce = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce);
  if (!isTimestampNonce && !isUuidNonce) return null;

  return { templateVersionId, idempotencyKey };
}
