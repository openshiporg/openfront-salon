import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, History, ReceiptText, RotateCcw } from 'lucide-react';
import { getSale } from '../actions/sales';
import { CompensationForm, RefundForm, type RefundableLine } from './SaleForms';
import { paymentLabel, paymentTone, saleClient } from './SalesListPage';
import { Fact, labelize, PageHeader, Panel, PillLink, PlatformPage, TitleStatus, Track, usd } from '../../components/salon-ui';

const reversalLabel: Record<string, string> = { refund: 'Refund', partial_refund: 'Partial refund', void: 'Void', compensation: 'Compensation adjustment' };

export async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sale, compensation } = await getSale(id);
  if (!sale) notFound();
  const payment = sale.appointment?.payment;
  const zone = sale.location?.timezone || undefined;
  const when = (value?: string | null) => value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone }) : '—';
  const name = saleClient(sale);

  const refundable: RefundableLine[] = sale.lineItems.flatMap((line) => {
    const reversed = line.reversalLines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const remaining = Number(line.quantity || 0) - reversed;
    if (remaining <= 0) return [];
    const net = Number(line.unitPrice || 0) * Number(line.quantity || 0) - Number(line.discount || 0);
    return [{ id: line.id, title: line.title || line.service?.name || line.product?.name || labelize(line.itemType), isProduct: line.itemType === 'product', remaining, unitNet: Math.round(net / Math.max(1, Number(line.quantity || 1))) }];
  });
  const tipRefunded = sale.reversals.reduce((sum, item) => sum + Math.abs(Number(item.tipDelta || 0)), 0);
  const remainingTip = Math.max(0, Number(payment?.tip || 0) - tipRefunded);
  const packageCredit = Number(sale.metadata?.packageCredit || 0);

  return (
    <PlatformPage width="narrow" breadcrumbs={[{ type: 'link', label: 'Sales & refunds', href: '/platform/sales' }, { type: 'page', label: name }]}>
      <PageHeader
        icon={ReceiptText}
        title={name}
        status={<TitleStatus tone={paymentTone[payment?.status || ''] || 'zinc'}>{paymentLabel[payment?.status || ''] || labelize(payment?.status) || 'No payment'}</TitleStatus>}
        meta={<><span>{when(sale.completedAt)}</span><span>{labelize(sale.paymentMethod) || 'Method not recorded'}</span>{sale.location?.name ? <span>{sale.location.name}</span> : null}</>}
        actions={sale.appointment?.id ? <Track><PillLink href={`/dashboard/platform/appointments/${sale.appointment.id}`} variant="quiet">Appointment</PillLink>{sale.client?.id ? <PillLink href={`/dashboard/platform/clients/${sale.client.id}`} variant="quiet">Client</PillLink> : null}</Track> : null}
      />

      <Panel title="Ticket" icon={ReceiptText} padded={false}>
        <ul className="divide-y">
          {sale.lineItems.map((line) => {
            const reversed = line.reversalLines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            return (
              <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-4 py-3 text-sm md:px-5">
                <span className="min-w-0"><span className="block truncate font-medium">{line.title || line.service?.name || line.product?.name || 'Item'}</span><span className="block truncate text-xs text-muted-foreground">{[line.itemType === 'product' ? 'Retail' : line.staff?.user?.name, line.quantity > 1 ? `× ${line.quantity}` : '', reversed ? `${reversed} refunded` : ''].filter(Boolean).join(' · ')}</span></span>
                <span className="tabular-nums">{usd(line.unitPrice * line.quantity - Number(line.discount || 0))}</span>
              </li>
            );
          })}
        </ul>
        {payment ? (
          <dl className="grid grid-cols-2 gap-3 border-t bg-muted/30 px-4 py-3 sm:grid-cols-3 md:px-5">
            <Fact label="Subtotal">{usd(payment.subtotal)}</Fact>
            <Fact label="Discount">{payment.discount ? `−${usd(payment.discount)}` : usd(0)}</Fact>
            <Fact label="Tax">{usd(payment.tax)}</Fact>
            <Fact label="Tip">{usd(payment.tip)}</Fact>
            <Fact label="Paid">{usd(payment.totalAmount)}</Fact>
            <Fact label="Refunded">{usd(payment.refundedAmount)}</Fact>
          </dl>
        ) : null}
      </Panel>

      {payment ? <Panel title="Refund" icon={RotateCcw}><RefundForm transactionId={sale.id} lines={refundable} remainingTip={remainingTip} packageCredit={packageCredit} idempotencyKey={`sale-reversal:${sale.id}:${randomUUID()}`} /></Panel> : null}

      {compensation && (compensation.commissions.length || compensation.tips.length) ? (
        <Panel title="Commission & tips" icon={Banknote}>
          <div className="grid gap-5">
            <ul className="grid gap-1.5 text-sm">
              {compensation.commissions.map((item) => {
                const adjusted = item.commissionAmount + item.adjustments.reduce((sum, adj) => sum + adj.amountDelta, 0);
                return <li key={item.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{item.stylist?.user?.name || 'Stylist'} · {item.service?.name || 'Service'} commission{item.isPaid ? ' · paid' : ''}</span><span className="tabular-nums">{usd(adjusted)}</span></li>;
              })}
              {compensation.tips.map((item) => <li key={item.id} className="flex justify-between gap-3 text-muted-foreground"><span className="min-w-0 truncate">{item.practitioner?.user?.name || 'Stylist'} · tip {item.type === 'recovery' ? 'recovery' : ''} · {labelize(item.payoutStatus)}</span><span className="tabular-nums">{usd(item.amountDelta)}</span></li>)}
            </ul>
            <CompensationForm
              transactionId={sale.id}
              commissions={compensation.commissions.map((item) => ({ id: item.id, label: `${item.stylist?.user?.name || 'Stylist'} · ${item.service?.name || 'Service'}` }))}
              tips={compensation.tips.filter((item) => item.type === 'allocation' && item.amountDelta > 0).map((item) => ({ id: item.id, label: `${item.practitioner?.user?.name || 'Stylist'} · ${usd(item.amountDelta)}` }))}
              stylists={compensation.stylists}
            />
          </div>
        </Panel>
      ) : null}

      <Panel title="History" icon={History} padded={false}>
        {sale.reversals.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No refunds or adjustments.</p> : (
          <ul className="divide-y">
            {sale.reversals.map((item) => (
              <li key={item.id} className="grid gap-1 px-4 py-3 text-sm md:px-5">
                <span className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 font-medium">{reversalLabel[item.type] || labelize(item.type)}<TitleStatus tone={item.status === 'posted' ? 'emerald' : 'amber'}>{labelize(item.status)}</TitleStatus></span><span className="tabular-nums">{item.type === 'compensation' ? `${item.commissionDelta >= 0 ? '+' : '−'}${usd(Math.abs(item.commissionDelta))} commission` : `−${usd(Math.abs(item.paymentDelta))}`}</span></span>
                <span className="text-xs text-muted-foreground">{when(item.postedAt)}{item.actor?.name ? ` · ${item.actor.name}` : ''} · {item.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Link href="/dashboard/platform/sales" className="text-sm font-medium underline-offset-4 hover:underline">All sales</Link>
    </PlatformPage>
  );
}

export default SaleDetailPage;
