// "Refund deposit" on the appointment page. Pure helpers so the rules are testable
// without a browser, database or payment processor.

export type DepositSessionRow = {
  id: string;
  status?: string | null;
  amount?: number | null;
  providerReference?: string | null;
  data?: unknown;
  provider?: { adapter?: string | null } | null;
  payment?: { status?: string | null; refundedAmount?: number | null } | null;
};

export type DepositRefundResult = { success: boolean; error?: string | null; status?: string | null; refundId?: string | null };

const REFUNDABLE = ['completed', 'partially_refunded'];
const purposeOf = (data: unknown) => (data && typeof data === 'object' ? (data as Record<string, unknown>).purpose : null);

/**
 * The one card deposit (paid online through Stripe) that still holds money, if any.
 * Desk deposits recorded as cash or on an external terminal are never refunded here:
 * the salon hands that money back itself. Once checkout applies the deposit, the
 * sale reversal on the receipt owns the refund instead.
 */
export function refundableDeposit(sessions: DepositSessionRow[] | null | undefined, opts: { hasCheckout: boolean }) {
  if (opts.hasCheckout) return null;
  for (const session of sessions || []) {
    if (!session?.id || purposeOf(session.data) !== 'appointment_deposit' || session.provider?.adapter !== 'stripe') continue;
    if (!REFUNDABLE.includes(String(session.payment?.status))) continue;
    const remaining = Math.max(0, (session.amount || 0) - (session.payment?.refundedAmount || 0));
    if (remaining > 0) return { id: session.id, remaining };
  }
  return null;
}

/** What the deposit panel says once money went back. Null when nothing was refunded. */
export function depositRefundState(sessions: DepositSessionRow[] | null | undefined): { tone: 'refunded' | 'partial'; refunded: number } | null {
  const deposits = (sessions || []).filter((session) => purposeOf(session?.data) === 'appointment_deposit');
  const refunded = deposits.reduce((sum, session) => sum + Math.max(0, session.payment?.refundedAmount || 0), 0);
  if (refunded <= 0) return null;
  return { tone: deposits.some((session) => session.payment?.status === 'partially_refunded') ? 'partial' : 'refunded', refunded };
}

export function depositRefundFeedback(result: DepositRefundResult, amountLabel: string) {
  if (!result.success) return result.error || 'Unable to refund this deposit.';
  if (result.status === 'refunded') return `Deposit refunded: ${amountLabel} back to the card.`;
  if (result.status === 'partially_refunded') return 'Deposit partly refunded. Refresh to see what is left.';
  return `Deposit is ${String(result.status || 'pending').replace(/_/g, ' ')}, not refunded yet. Refresh to check it.`;
}

const AWAITING = ['pending', 'requires_action', 'authorized'];

/**
 * The online card deposit whose Stripe Checkout is still open on our side, if any.
 * Staff can ask Stripe whether it was paid (confirmPayment reads the Checkout back),
 * for when the customer paid but never landed on the return page.
 */
export function pendingOnlineDeposit(sessions: DepositSessionRow[] | null | undefined) {
  for (const session of sessions || []) {
    const data = session?.data && typeof session.data === 'object' ? session.data as Record<string, unknown> : {};
    if (!session?.id || data.purpose !== 'appointment_deposit' || !data.checkout || !session.providerReference) continue;
    if (session.provider?.adapter !== 'stripe' || !AWAITING.includes(String(session.status))) continue;
    return { id: session.id };
  }
  return null;
}

export type ConfirmPaymentResult = { success: boolean; error?: string | null; status?: string | null };

export function depositCheckFeedback(result: ConfirmPaymentResult, amountLabel: string): { ok: boolean; text: string } {
  if (!result.success) return { ok: false, text: result.error || 'Could not reach Stripe. Try again in a moment.' };
  if (result.status === 'completed') return { ok: true, text: `Stripe shows the ${amountLabel} deposit paid. Marked paid.` };
  if (result.status === 'refunded' || result.status === 'partially_refunded') return { ok: true, text: 'Stripe shows this deposit refunded. Updated.' };
  if (result.status === 'cancelled' || result.status === 'failed') return { ok: true, text: 'The Stripe checkout expired unpaid. Record the deposit at the desk or send a new link.' };
  return { ok: true, text: 'Stripe has no payment yet. The client hasn’t finished paying.' };
}
