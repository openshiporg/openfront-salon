// Payment panel rows for provider payment sessions (online deposits, card attempts).
// Pure so the labels are testable; the page only renders what this returns.

export type SessionInput = {
  id: string;
  status?: string | null;
  amount?: number | null;
  createdAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
  data?: unknown;
  provider?: { name?: string | null; adapter?: string | null } | null;
  payment?: { id: string; refundedAmount?: number | null } | null;
};

export type SessionRow = {
  id: string;
  tone: 'emerald' | 'amber' | 'rose' | 'zinc';
  status: string;
  purpose: string;
  amount: number;
  refunded: number;
  provider: string;
  at: string | null;
};

const STATUS: Record<string, { label: string; tone: SessionRow['tone'] }> = {
  completed: { label: 'Paid', tone: 'emerald' },
  refunded: { label: 'Refunded', tone: 'zinc' },
  partially_refunded: { label: 'Partly refunded', tone: 'amber' },
  pending: { label: 'Awaiting payment', tone: 'amber' },
  requires_action: { label: 'Needs action', tone: 'amber' },
  authorized: { label: 'Authorized', tone: 'amber' },
  failed: { label: 'Failed', tone: 'rose' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
};

function isDepositSession(session: SessionInput) {
  return (session.data as Record<string, unknown> | null)?.purpose === 'appointment_deposit';
}

/**
 * One row per session, newest first, skipping sessions whose payment the panel already
 * shows as a payment row, and deposit sessions when the Deposit card shows them. The date is when the session last changed state.
 */
export function paymentSessionRows(
  sessions: SessionInput[] | null | undefined,
  shownPaymentIds: string[] = [],
  options: { depositShownElsewhere?: boolean } = {},
): SessionRow[] {
  const shown = new Set(shownPaymentIds);
  return (sessions || [])
    .filter((session) => session?.id && !(session.payment?.id && shown.has(session.payment.id)))
    // The Deposit card already reports the deposit (paid, refunded); don't list it twice.
    .filter((session) => !(options.depositShownElsewhere && isDepositSession(session)))
    .map((session) => {
      const status = String(session.status || 'pending');
      const known = STATUS[status] || { label: status.replace(/_/g, ' '), tone: 'zinc' as const };
      const purpose = isDepositSession(session) ? 'Deposit' : 'Payment';
      const at = (status === 'refunded' || status === 'partially_refunded' ? session.refundedAt : null)
        || (status === 'failed' || status === 'cancelled' ? session.failedAt : null)
        || session.completedAt || session.createdAt || null;
      return {
        id: session.id,
        tone: known.tone,
        status: known.label,
        purpose,
        amount: Math.max(0, session.amount || 0),
        refunded: Math.max(0, session.payment?.refundedAmount || 0),
        provider: session.provider?.name || (session.provider?.adapter === 'stripe' ? 'Stripe' : session.provider?.adapter === 'manual' ? 'In salon' : 'Provider'),
        at,
      };
    });
}
