import { randomUUID } from 'node:crypto';
import { Gift, Search } from 'lucide-react';
import { changeGiftCardBalance, getGiftCards, sellGiftCard, type PlatformGiftCard } from '../actions/giftCards';
import { ActionForm } from '../../components/ActionForm';
import { EmptyState, ErrorState, fieldLabelClass, inputClass, labelize, MetricStrip, PageHeader, Panel, PlatformPage, SegmentTabs, TitleStatus, textareaClass, usd, type Tone } from '../../components/salon-ui';
import { getSalonTimezone } from '../../lib/salonTimezone';

const tabs = [
  { value: 'active', label: 'Active' },
  { value: 'spent', label: 'Used up' },
  { value: 'expired', label: 'Expired' },
  { value: 'all', label: 'All' },
] as const;

function cardState(card: PlatformGiftCard): { label: string; tone: Tone } {
  if (!card.isActive) return { label: 'Inactive', tone: 'zinc' };
  if (card.expiresAt && new Date(card.expiresAt).getTime() <= Date.now()) return { label: 'Expired', tone: 'rose' };
  if (card.currentBalance <= 0) return { label: 'Used up', tone: 'zinc' };
  return { label: 'Active', tone: 'emerald' };
}

export async function GiftCardsPage({ searchParams }: { searchParams?: Promise<{ status?: string; q?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const status = tabs.some((tab) => tab.value === params.status) ? params.status! : 'active';
  const q = (params.q || '').slice(0, 100);
  const [data, timeZone] = await Promise.all([getGiftCards(status, q), getSalonTimezone()]);
  const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : '—';
  const href = (value: string) => {
    const next = new URLSearchParams();
    if (value !== 'active') next.set('status', value);
    if (q) next.set('q', q);
    return next.size ? `/dashboard/platform/gift-cards?${next}` : '/dashboard/platform/gift-cards';
  };

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Gift cards' }]}>
      <PageHeader icon={Gift} title="Gift cards" status={data ? <TitleStatus tone="emerald">{data.counts.active} active</TitleStatus> : null} />
      {!data ? <ErrorState id="gift-cards-error" title="Gift cards couldn't be loaded" message="Check your payment access, then reload." action={null} /> : (
        <>
          <MetricStrip items={[
            { label: 'Active cards', value: data.counts.active, tone: 'emerald' },
            { label: 'Outstanding balance', value: usd(data.outstanding) },
            { label: 'Used up', value: data.counts.spent },
            { label: 'Expired', value: data.counts.expired, tone: data.counts.expired ? 'rose' : undefined },
          ]} />

          <Panel title="Sell a gift card" icon={Gift}>
            {data.purchasers.length === 0 ? <p className="text-sm text-muted-foreground">The purchaser needs a client account. Add the client first.</p> : (
              <ActionForm action={sellGiftCard} submitLabel="Issue gift card" pendingLabel="Issuing…" resetOnSuccess>
                <input type="hidden" name="idempotencyKey" value={`desk-gift-card:${randomUUID()}`} />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className={fieldLabelClass}>Purchaser
                    <select name="purchaserEmail" required className={inputClass} defaultValue="">
                      <option value="" disabled>Choose a client</option>
                      {data.purchasers.map((person) => <option key={person.email} value={person.email}>{person.name} · {person.email}</option>)}
                    </select>
                  </label>
                  <label className={fieldLabelClass}>Amount<input name="amount" type="number" min="25" max="500" step="0.01" required inputMode="decimal" placeholder="50.00" className={inputClass} /></label>
                  <label className={fieldLabelClass}>Recipient name<input name="recipientName" maxLength={120} className={inputClass} /></label>
                  <label className={fieldLabelClass}>Recipient email<input name="recipientEmail" type="email" maxLength={254} className={inputClass} /></label>
                </div>
                <label className={fieldLabelClass}>Message<textarea name="message" maxLength={2000} className={`${textareaClass} min-h-16`} /></label>
              </ActionForm>
            )}
          </Panel>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SegmentTabs label="Gift card status" active={status} tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label, href: href(tab.value), count: tab.value === 'active' ? data.counts.active : tab.value === 'spent' ? data.counts.spent : tab.value === 'expired' ? data.counts.expired : data.counts.all }))} />
            <form className="relative w-full md:w-72" role="search">
              {status !== 'active' ? <input type="hidden" name="status" value={status} /> : null}
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" type="search" defaultValue={q} placeholder="Code or recipient" aria-label="Search gift cards" className={`${inputClass} pl-9`} />
            </form>
          </div>

          {data.giftCards.length === 0 ? <EmptyState icon={Gift} title="No gift cards in this view" /> : (
            <ul className="grid gap-3">
              {data.giftCards.map((card) => {
                const state = cardState(card);
                return (
                  <li key={card.id} className="min-w-0 overflow-hidden rounded-2xl border bg-background">
                    <details className="group">
                      <summary className="grid cursor-pointer list-none gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono text-sm font-semibold">{card.code}</span><TitleStatus tone={state.tone}>{state.label}</TitleStatus></span>
                          <span className="block truncate text-xs text-muted-foreground">{card.recipientName || card.recipientEmail || 'No recipient'} · bought by {card.purchasedBy?.name || card.purchasedBy?.email || 'unknown'} · expires {date(card.expiresAt)}</span>
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{usd(card.currentBalance)} <span className="font-normal text-muted-foreground">of {usd(card.initialValue)}</span></span>
                      </summary>
                      <div className="grid gap-5 border-t px-4 py-4 md:grid-cols-2 md:px-5">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-muted-foreground">Balance history</h3>
                          <ul className="mt-2 grid gap-1.5 text-sm">
                            {card.transactions.map((item) => <li key={item.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{labelize(item.type)} · {date(item.createdAt)}{item.notes && !item.notes.startsWith('provider:') ? ` · ${item.notes}` : ''}</span><span className="tabular-nums">{item.amount >= 0 ? '+' : '−'}{usd(Math.abs(item.amount))}</span></li>)}
                          </ul>
                        </div>
                        {state.label === 'Active' || state.label === 'Used up' ? (
                          <ActionForm action={changeGiftCardBalance} submitLabel="Apply" resetOnSuccess>
                            <input type="hidden" name="giftCardId" value={card.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className={fieldLabelClass}>Action<select name="action" className={inputClass}><option value="redemption">Redeem</option><option value="refund">Return value to card</option></select></label>
                              <label className={fieldLabelClass}>Amount<input name="amount" type="number" min="0.01" step="0.01" required inputMode="decimal" className={inputClass} /></label>
                            </div>
                            <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={1000} className={inputClass} /></label>
                          </ActionForm>
                        ) : null}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </PlatformPage>
  );
}

export default GiftCardsPage;
