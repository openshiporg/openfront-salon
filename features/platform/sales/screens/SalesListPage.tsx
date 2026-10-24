import Link from 'next/link';
import { ArrowUpRight, ReceiptText, Search } from 'lucide-react';
import { getSales, type Sale } from '../actions/sales';
import { EmptyState, ErrorState, inputClass, labelize, MetricStrip, PageHeader, PlatformPage, SegmentTabs, TitleStatus, usd, type Tone } from '../../components/salon-ui';
import { appointmentContact } from '../../lib/appointmentContact';
import { getSalonTimezone } from '../../lib/salonTimezone';

const tabs = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partly refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'all', label: 'All' },
] as const;

export const paymentTone: Record<string, Tone> = { completed: 'emerald', partially_refunded: 'amber', refunded: 'rose' };
export const paymentLabel: Record<string, string> = { completed: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' };

export function saleClient(sale: Sale) {
  return sale.client?.displayName || (sale.appointment ? appointmentContact({ metadata: sale.appointment.metadata }).name : 'Walk-in');
}

export async function SalesListPage({ searchParams }: { searchParams?: Promise<{ status?: string; q?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const status = tabs.some((tab) => tab.value === params.status) ? params.status! : 'all';
  const q = (params.q || '').slice(0, 100);
  const [data, timeZone] = await Promise.all([getSales(status, q), getSalonTimezone()]);
  const query = (value: string) => {
    const next = new URLSearchParams();
    if (value !== 'all') next.set('status', value);
    if (q) next.set('q', q);
    return next.size ? `/dashboard/platform/sales?${next}` : '/dashboard/platform/sales';
  };

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Sales & refunds' }]}>
      <PageHeader icon={ReceiptText} title="Sales & refunds" status={data ? <TitleStatus tone={data.counts.partial || data.counts.refunded ? 'amber' : 'emerald'}>{data.counts.all} sales</TitleStatus> : null} />
      {!data ? <ErrorState id="sales-error" title="Sales couldn't be loaded" message="Check your payment access, then reload." action={null} /> : (
        <>
          <MetricStrip items={[
            { label: 'Paid', value: data.counts.paid, tone: 'emerald' },
            { label: 'Partly refunded', value: data.counts.partial, tone: data.counts.partial ? 'amber' : undefined },
            { label: 'Refunded', value: data.counts.refunded, tone: data.counts.refunded ? 'rose' : undefined },
          ]} />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SegmentTabs label="Payment status" active={status} tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label, href: query(tab.value), count: data.counts[tab.value] }))} />
            <form className="relative w-full md:w-72" role="search">
              {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input name="q" type="search" defaultValue={q} placeholder="Client or item" aria-label="Search sales" className={`${inputClass} pl-9`} />
            </form>
          </div>
          {data.sales.length === 0 ? <EmptyState icon={ReceiptText} title="No sales in this view" /> : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
              {data.sales.map((sale) => {
                const payment = sale.appointment?.payment;
                const net = (payment?.totalAmount || 0) - (payment?.refundedAmount || 0);
                const items = sale.lineItems.map((line) => line.title || line.service?.name || line.product?.name).filter(Boolean).join(' · ');
                const when = sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: sale.location?.timezone || timeZone }) : '—';
                return (
                  <li key={sale.id}>
                    <Link href={`/dashboard/platform/sales/${sale.id}`} className="grid min-w-0 gap-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center md:px-5">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate font-semibold">{saleClient(sale)}</span><TitleStatus tone={paymentTone[payment?.status || ''] || 'zinc'}>{paymentLabel[payment?.status || ''] || labelize(payment?.status) || 'No payment'}</TitleStatus></span>
                        <span className="block truncate text-xs text-muted-foreground">{when} · {labelize(sale.paymentMethod) || 'Method not recorded'} · {items || 'No lines'}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">{usd(net)}{payment?.refundedAmount ? <span className="text-xs font-normal text-muted-foreground">of {usd(payment.totalAmount)}</span> : null}<ArrowUpRight className="size-4 text-muted-foreground" /></span>
                    </Link>
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

export default SalesListPage;
