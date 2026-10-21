export type CancellationPolicyGuidance = {
  deadline: string | null;
  expired: boolean;
  notice: string;
};

export function getCancellationPolicyGuidance(
  policy: { cancellationDeadline?: unknown } | null | undefined,
  now: number = Date.now(),
): CancellationPolicyGuidance {
  const candidate = policy?.cancellationDeadline;
  const deadlineAt = typeof candidate === 'string' && /(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(candidate)
    ? Date.parse(candidate)
    : Number.NaN;
  const deadline = typeof candidate === 'string' && Number.isFinite(deadlineAt) ? candidate : null;

  if (!deadline) {
    return {
      deadline: null,
      expired: false,
      notice: 'Cancellations follow the salon\'s cancellation policy.',
    };
  }

  if (deadlineAt <= now) {
    return {
      deadline,
      expired: true,
      notice: 'It\'s too late to cancel online. Contact the salon to cancel this appointment.',
    };
  }

  return {
    deadline,
    expired: false,
    notice: 'You can cancel online until the time shown above.',
  };
}
