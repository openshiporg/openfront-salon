type EffectiveWindow = {
  effectiveFrom: Date | string;
  effectiveUntil?: Date | string | null;
};

function instant(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value);
  return Number.NaN;
}

/** Require an effective-dated definition to cover the whole scheduled segment. */
export function isServiceSegmentEffectiveForInterval(
  definition: EffectiveWindow,
  segmentStart: Date,
  segmentEnd: Date,
) {
  const effectiveFrom = instant(definition.effectiveFrom);
  const effectiveUntil = definition.effectiveUntil == null ? Number.POSITIVE_INFINITY : instant(definition.effectiveUntil);
  const start = segmentStart.getTime();
  const end = segmentEnd.getTime();

  return Number.isFinite(effectiveFrom)
    && Number.isFinite(start)
    && Number.isFinite(end)
    && (Number.isFinite(effectiveUntil) || effectiveUntil === Number.POSITIVE_INFINITY)
    && effectiveFrom <= start
    && start < end
    && end <= effectiveUntil;
}
