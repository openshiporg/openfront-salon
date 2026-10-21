export type ReschedulePolicyGuidance = {
  deadline: string | null;
  expired: boolean;
};

export function getReschedulePolicyGuidance(
  policy: { rescheduleDeadline?: unknown } | null | undefined,
  now: number = Date.now(),
): ReschedulePolicyGuidance {
  const candidate = policy?.rescheduleDeadline;
  const deadlineAt = typeof candidate === "string" && /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(candidate)
    ? Date.parse(candidate)
    : Number.NaN;
  const deadline = typeof candidate === "string" && Number.isFinite(deadlineAt) ? candidate : null;

  return {
    deadline,
    expired: deadline !== null && deadlineAt <= now,
  };
}
