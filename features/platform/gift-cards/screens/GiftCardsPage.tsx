import { randomUUID } from 'node:crypto';
import { Gift, Search } from 'lucide-react';
import { changeGiftCardBalance, getGiftCards, sellGiftCard, type PlatformGiftCard } from '../actions/giftCards';
import { ActionForm } from '../../components/ActionForm';
import { EmptyState, ErrorState, fieldLabelClass, inputClass, labelize, PageHeader, Panel, pillClass, PlatformPage, SegmentTabs, StatusCell, textareaClass, usd, type Tone } from '../../components/salon-ui';
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
      <PageHeader title="Gift cards" meta={data ? <span>{data.counts.active} active · {usd(data.outstanding)} outstanding{data.counts.expired ? ` · ${data.counts.expired} expired` : ''}</span> : null} />
      {!data ? <ErrorState id="gift-cards-error" title="Gift cards couldn't be loaded" message="Check your payment access, then reload." action={null} /> : (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
            <Panel title="Check balance" icon={Search}>
              <form role="search" className="flex gap-2">
                <input type="hidden" name="status" value="all" />
                <label className="min-w-0 flex-1"><span className="sr-only">Gift card code or recipient</span><input name="q" type="search" defaultValue={q} placeholder="Code or recipient" autoComplete="off" className={`${inputClass} font-mono`} /></label>
                <button type="submit" className={pillClass('primary', 'md')}>Look up</button>
              </form>
              {q ? (
                <div className="mt-3 border-t pt-3">
                  {data.giftCards.length === 0 ? <p className="text-sm text-muted-foreground">No card matches &ldquo;{q}&rdquo;.</p> : (
                    <dl className="grid gap-2">
                      {data.giftCards.slice(0, 3).map((card) => {
                        const state = cardState(card);
                        return (
                          <div key={card.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <dt className="min-w-0"><span className="font-mono text-sm font-semibold">{card.code}</span> <StatusCell tone={state.tone}>{state.label}</StatusCell></dt>
                            <dd className="text-lg font-semibold tabular-nums">{usd(card.currentBalance)}<span className="ml-1 text-sm font-normal text-muted-foreground">of {usd(card.initialValue)}</span></dd>
                          </div>
                        );
                      })}
                      {data.giftCards.length > 3 ? <p className="text-xs text-muted-foreground">{data.giftCards.length - 3} more below</p> : null}
                    </dl>
                  )}
                  <a href="/dashboard/platform/gift-cards" className="mt-2 inline-block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear</a>
                </div>
              ) : null}
            </Panel>

            <Panel title="Sell a gift card" icon={Gift}>
              {data.purchasers.length === 0 ? <p className="text-sm text-muted-foreground">The purchaser needs a client account. Add the client first.</p> : (
                <ActionForm action={sellGiftCard} submitLabel="Issue gift card" pendingLabel="Issuing…" resetOnSuccess size="md">
                  <input type="hidden" name="idempotencyKey" value={`desk-gift-card:${randomUUID()}`} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={fieldLabelClass}>Purchaser
                      <select name="purchaserEmail" required className={inputClass} defaultValue="">
                        <option value="" disabled>Choose a client</option>
                        {data.purchasers.map((person) => <option key={person.email} value={person.email}>{person.name} · {person.email}</option>)}
                      </select>
                    </label>
                    <label className={fieldLabelClass}>Amount<span className="relative block"><span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><input name="amount" type="number" min="25" max="500" step="0.01" required inputMode="decimal" placeholder="50.00" className={`${inputClass} pl-6 tabular-nums`} /></span></label>
                    <label className={fieldLabelClass}>Recipient name<input name="recipientName" maxLength={120} className={inputClass} /></label>
                    <label className={fieldLabelClass}>Recipient email<input name="recipientEmail" type="email" maxLength={254} className={inputClass} /></label>
                  </div>
                  <label className={fieldLabelClass}>Message<textarea name="message" maxLength={2000} rows={2} className={`${textareaClass} min-h-0`} /></label>
                </ActionForm>
              )}
            </Panel>
          </div>

          <section aria-labelledby="issued-cards" className="grid gap-2">
            <h2 id="issued-cards" className="text-sm font-semibold">Issued cards</h2>
            <SegmentTabs label="Gift card status" active={status} tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label, href: href(tab.value), count: tab.value === 'active' ? data.counts.active : tab.value === 'spent' ? data.counts.spent : tab.value === 'expired' ? data.counts.expired : data.counts.all }))} />
            {data.giftCards.length === 0 ? <EmptyState icon={Gift} title={q ? `No cards match "${q}"` : 'No gift cards in this view'} /> : (
              <div className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
                <div aria-hidden="true" className="hidden h-9 grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_7rem_7rem_6rem_5rem] items-center gap-3 border-b bg-muted/40 px-3 text-xs font-medium text-muted-foreground md:grid">
                  <span>Code</span><span>Recipient</span><span>Bought by</span><span className="text-right">Balance</span><span>Expires</span><span>Status</span><span />
                </div>
                <ul className="divide-y">
                  {data.giftCards.map((card) => {
                    const state = cardState(card);
                    return (
                      <li key={card.id} className="min-w-0">
                        <details className="group">
                          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm hover:bg-muted/30 md:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_7rem_7rem_6rem_5rem] md:items-center [&::-webkit-details-marker]:hidden">
                            <span className="font-mono font-semibold">{card.code}</span>
                            <span className="min-w-0 truncate max-md:order-3 max-md:col-span-2 max-md:text-xs max-md:text-muted-foreground">{card.recipientName || card.recipientEmail || 'No recipient'}</span>
                            <span className="hidden min-w-0 truncate text-muted-foreground md:block">{card.purchasedBy?.name || card.purchasedBy?.email || 'Unknown'}</span>
                            <span className="text-right font-semibold tabular-nums max-md:order-2">{usd(card.currentBalance)}<span className="block text-xs font-normal text-muted-foreground">of {usd(card.initialValue)}</span></span>
                            <span className="hidden whitespace-nowrap tabular-nums text-muted-foreground md:block">{date(card.expiresAt)}</span>
                            <span className="max-md:order-4"><StatusCell tone={state.tone}>{state.label}</StatusCell></span>
                            <span className="text-xs font-medium text-muted-foreground max-md:order-5 md:text-right"><span className="group-open:hidden">Manage</span><span className="hidden group-open:inline">Close</span></span>
                          </summary>
                          <div className="grid gap-5 border-t bg-muted/10 px-3 py-4 md:grid-cols-2">
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
              </div>
            )}
          </section>
        </>
      )}
    </PlatformPage>
  );
}

export default GiftCardsPage;
