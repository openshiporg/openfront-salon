'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CreditCard, ExternalLink, RotateCw, X } from 'lucide-react';
import { cancelDeskCard, checkDeskCard, startDeskCard, type DeskCardState } from '../actions/deskCard';
import { pillClass, trackClass } from '../../components/pill';

const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/**
 * Card at the front desk: Stripe prices nothing itself. Checkout prices the visit, Stripe hosts the card form
 * (open it at the desk or text the link to the client), and the sale is recorded once Stripe says it's paid.
 */
export function DeskCardPanel({ appointmentId, initial, formId }: { appointmentId: string; initial: DeskCardState | null; formId: string }) {
  const router = useRouter();
  const live = initial && (initial.status === 'pending' || (initial.status === 'completed' && !initial.recorded)) ? initial : null;
  const [card, setCard] = useState<DeskCardState | null>(live);
  const [busy, setBusy] = useState<'start' | 'check' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = card?.status === 'pending' && card.sessionId;
  useEffect(() => {
    if (!open || !card?.sessionId) return;
    const id = window.setInterval(async () => {
      const next = await checkDeskCard(card.sessionId!, appointmentId);
      if (next.status !== 'pending' || next.recorded) { setCard(next); if (next.recorded) router.refresh(); }
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, card?.sessionId, appointmentId, router]);

  async function start() {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    setBusy('start'); setError(null);
    const next = await startDeskCard(new FormData(form));
    setBusy(null);
    if (!next.success) { setError(next.error); return; }
    setCard(next);
    if (next.url) window.open(next.url, '_blank', 'noopener');
  }
  async function check() {
    if (!card?.sessionId) return;
    setBusy('check'); setError(null);
    const next = await checkDeskCard(card.sessionId, appointmentId);
    setBusy(null);
    if (!next.success) setError(next.error);
    setCard(next);
    if (next.recorded) router.refresh();
  }
  async function cancel() {
    if (!card?.sessionId) return;
    setBusy('cancel'); setError(null);
    const next = await cancelDeskCard(card.sessionId, appointmentId);
    setBusy(null);
    if (!next.success) { setError(next.error); return; }
    setCard(null);
  }
  async function copy() {
    if (!card?.url) return;
    await navigator.clipboard.writeText(card.url).catch(() => undefined);
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  }

  if (card?.recorded) return <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">Card payment of {usd(card.amount || 0)} recorded.</p>;

  return (
    <div className="mt-3 grid gap-2 border-t pt-3">
      {!card || card.status === 'cancelled' || card.status === 'refunded' ? (
        <>
          <div className={`${trackClass} flex w-full`}>
            <button type="button" onClick={start} disabled={busy !== null} className={`${pillClass('raised')} h-10 flex-1`}>
              <CreditCard />{busy === 'start' ? 'Opening card payment…' : 'Charge card with Stripe'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Uses the tip, discount and retail above. The client can pay on this screen or on their phone.</p>
        </>
      ) : card.status === 'pending' ? (
        <div className="grid gap-2 rounded-[6px] border p-3">
          <p className="text-sm font-medium">Waiting for card · {usd(card.amount || 0)}</p>
          <p className="text-xs text-muted-foreground">Checkout records itself as soon as Stripe confirms the payment.</p>
          <div className={trackClass}>
            {card.url ? <a href={card.url} target="_blank" rel="noopener noreferrer" className={pillClass('primary', 'sm')}><ExternalLink />Open card form</a> : null}
            {card.url ? <button type="button" onClick={copy} className={pillClass('raised', 'sm')}><Copy />{copied ? 'Link copied' : 'Copy pay link'}</button> : null}
            <button type="button" onClick={check} disabled={busy !== null} className={pillClass('raised', 'sm')}><RotateCw />{busy === 'check' ? 'Checking…' : 'Check payment'}</button>
            <button type="button" onClick={cancel} disabled={busy !== null} className={pillClass('quiet', 'sm')}><X />{busy === 'cancel' ? 'Cancelling…' : 'Cancel'}</button>
          </div>
        </div>
      ) : card.status === 'completed' ? (
        <div className="grid gap-2 rounded-[6px] border border-amber-300 p-3 text-xs">
          <p>Card paid {usd(card.amount || 0)} but the sale isn&apos;t recorded yet.</p>
          <div className={trackClass}>
            <button type="button" onClick={check} disabled={busy !== null} className={pillClass('primary', 'sm')}><RotateCw />{busy === 'check' ? 'Recording…' : 'Record card payment'}</button>
            <button type="button" onClick={cancel} disabled={busy !== null} className={pillClass('danger', 'sm')}>{busy === 'cancel' ? 'Refunding…' : 'Refund card'}</button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
