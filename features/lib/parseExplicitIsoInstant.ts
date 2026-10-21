const EXPLICIT_ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

export function parseExplicitIsoInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!EXPLICIT_ISO_INSTANT.test(candidate) || !Number.isFinite(Date.parse(candidate))) return null;
  return candidate;
}
