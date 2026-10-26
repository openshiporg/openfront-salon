import Link from 'next/link';
import { ArrowUpRight, ReceiptText, Search } from 'lucide-react';
import { getSales, type Sale } from '../actions/sales';
import { EmptyState, ErrorState, inputClass, labelize, PageHeader, PillLink, PlatformPage, SegmentTabs, StatusCell, Track, usd, type Tone } from '../../components/salon-ui';
import { cn } from '@/lib/utils';
import { stackBodyClass, stackCellClass, stackHeadClass, stackRowClass, stackTableClass, stackThClass, stackWrapClass } from '../../appointments/lib/stackTable';
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
      <PageHeader
        icon={ReceiptText}
        title="Sales & refunds"
        meta={data && q ? <span className="tabular-nums">{data.sales.length}{data.sales.length === 100 ? '+' : ''} matching “{q}”</span> : null}
      />
      {!data ? <ErrorState id="sales-error" title="Sales couldn't be loaded" message="Check your payment access, then reload." action={null} /> : (
        <>
          <form className="relative w-full sm:max-w-md" role="search">
            {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" type="search" defaultValue={q} placeholder="Find a sale by client or item" aria-label="Search sales" className={`${inputClass} pl-8`} />
          </form>
          <SegmentTabs label="Payment status" active={status} tabs={tabs.map((tab) => ({ value: tab.value, label: tab.label, href: query(tab.value), count: data.counts[tab.value] }))} />
          {data.sales.length === 0 ? (
            <EmptyState icon={ReceiptText} title={q ? `No sales match “${q}”` : 'No sales in this view'} action={q || status !== 'all' ? <Track><PillLink href="/dashboard/platform/sales" variant="quiet">Clear filters</PillLink></Track> : <Track><PillLink href="/dashboard/platform/checkout" variant="quiet">Checkout</PillLink></Track>} />
          ) : (
            <div className={stackWrapClass}>
              <table className={stackTableClass} aria-label="Sales">
                <thead className={stackHeadClass}>
                  <tr>
                    {['Date', 'Client', 'Items', 'Payment', 'Refunds'].map((label) => <th key={label} scope="col" className={stackThClass}>{label}</th>)}
                    <th scope="col" className={cn(stackThClass, 'text-right')}>Total</th>
                    <th scope="col" className={stackThClass}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className={stackBodyClass}>
                  {data.sales.map((sale) => {
                    const payment = sale.appointment?.payment;
                    const refunded = payment?.refundedAmount || 0;
                    const net = (payment?.totalAmount || 0) - refunded;
                    const items = sale.lineItems.map((line) => line.title || line.service?.name || line.product?.name).filter(Boolean).join(', ');
                    const reversals = sale.reversals.filter((item) => item.type !== 'compensation');
                    const when = sale.completedAt ? new Date(sale.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: sale.location?.timezone || timeZone }) : '—';
                    const href = `/dashboard/platform/sales/${sale.id}`;
                    return (
                      <tr key={sale.id} className={cn(stackRowClass, 'grid-cols-[minmax(0,1fr)_auto]')}>
                        <td className={cn(stackCellClass, 'col-span-2 whitespace-nowrap text-xs tabular-nums text-muted-foreground lg:text-sm lg:text-foreground')}>{when}</td>
                        <td className={cn(stackCellClass, 'font-semibold lg:min-w-36')}><Link href={href} className="block truncate underline-offset-4 hover:underline">{saleClient(sale)}</Link></td>
                        <td className={cn(stackCellClass, 'col-start-1 truncate text-muted-foreground lg:max-w-72 lg:text-foreground')}>{items || 'No lines'}<span className="lg:hidden"> · {labelize(sale.paymentMethod) || 'Method not recorded'}</span></td>
                        <td className={cn(stackCellClass, 'col-start-1 flex flex-wrap items-center gap-x-3 lg:table-cell')}>
                          <StatusCell tone={paymentTone[payment?.status || ''] || 'zinc'}>{paymentLabel[payment?.status || ''] || labelize(payment?.status) || 'No payment'}</StatusCell>
                          <span className="hidden text-xs text-muted-foreground lg:block">{labelize(sale.paymentMethod) || 'Method not recorded'}</span>
                        </td>
                        <td className={cn(stackCellClass, 'col-start-1 text-xs text-muted-foreground empty:hidden lg:empty:table-cell')}>{refunded ? <span className="tabular-nums">−{usd(refunded)}{reversals.length ? ` · ${reversals.length} ${reversals.length === 1 ? 'reversal' : 'reversals'}` : ''}</span> : null}</td>
                        <td className={cn(stackCellClass, 'col-start-2 row-start-2 text-right tabular-nums')}>
                          <div className="font-semibold">{usd(net)}</div>
                          {refunded ? <div className="text-xs text-muted-foreground">of {usd(payment?.totalAmount)}</div> : null}
                        </td>
                        <td className={cn(stackCellClass, 'col-start-2 row-start-3 text-right lg:w-px')}><PillLink href={href} size="sm" variant="quiet">{payment && payment.status !== 'refunded' ? 'Refund' : 'Open'}<ArrowUpRight /></PillLink></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PlatformPage>
  );
}

export default SalesListPage;
