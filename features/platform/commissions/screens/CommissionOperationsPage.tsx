import Link from 'next/link';
import { Banknote, CheckCircle2 } from 'lucide-react';
import { getCommissionOperations, markCommissionPaid, markStylistCommissionsPaid, PlatformCommission } from '../actions/commissions';
import { Avatar, EmptyState, labelize, MetricStrip, PageHeader, Panel, PlatformPage, SegmentTabs, TitleStatus, usd } from '../../components/salon-ui';
import { appointmentContact } from '../../lib/appointmentContact';
import { getSalonTimezone } from '../../lib/salonTimezone';
import { PayoutForm } from './PayoutForm';

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

const tabs = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
] as const;

function formatDate(value?: string | null, timeZone?: string | null) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timeZone || undefined });
}

function rate(value?: number | null) {
  return `${Math.round((value || 0) * 1000) / 10}%`;
}

export async function CommissionOperationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = resolvedSearchParams.status || 'unpaid';
  const [{ commissions, summaries, counts, totals }, timeZone] = await Promise.all([getCommissionOperations(activeStatus), getSalonTimezone()]);
  const payable = summaries.filter((summary) => summary.unpaidCount > 0 || summary.tipsOwed > 0);

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Commissions' }]}>
      <PageHeader
        icon={Banknote}
        title="Commissions"
        status={<TitleStatus tone={counts.unpaid > 0 ? 'amber' : 'emerald'}>{counts.unpaid > 0 ? `${counts.unpaid} unpaid` : 'All paid out'}</TitleStatus>}
      />

      <MetricStrip
        items={[
          { label: 'Commission owed', value: usd(totals.unpaidAmount), tone: totals.unpaidAmount > 0 ? 'amber' : undefined },
          { label: 'Card tips owed', value: usd(totals.tipsOwed), tone: totals.tipsOwed > 0 ? 'amber' : undefined },
          { label: 'Paid out', value: usd(totals.paidAmount + totals.tipsPaid), tone: 'emerald' },
          { label: 'Service sales', value: usd(totals.grossSales) },
        ]}
      />

      {payable.length > 0 ? (
        <Panel title="Payout by stylist" padded={false}>
          <ul className="divide-y">
            {payable.map((summary) => (
              <li key={summary.stylistId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={summary.stylistName} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{summary.stylistName}</div>
                    <div className="text-xs text-muted-foreground">{usd(summary.unpaidAmount)} commission · {usd(summary.tipsOwed)} card tips</div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
                  <span className="text-base font-semibold tabular-nums">{usd(summary.unpaidAmount + summary.tipsOwed)}</span>
                  {summary.stylistId !== 'unassigned' ? (
                    <PayoutForm action={markStylistCommissionsPaid} field="stylistId" value={summary.stylistId} label="Pay out" amount={usd(summary.unpaidAmount + summary.tipsOwed)} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <SegmentTabs
        label="Commission status filters"
        active={activeStatus}
        tabs={tabs.map((tab) => ({
          value: tab.value,
          label: tab.label,
          href: tab.value === 'unpaid' ? '/dashboard/platform/commissions' : `/dashboard/platform/commissions?status=${tab.value}`,
          count: tab.value === 'unpaid' ? counts.unpaid : tab.value === 'paid' ? counts.paid : counts.total,
        }))}
      />

      {commissions.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No commissions in this view" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-background">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_7rem_8rem] gap-4 border-b px-5 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
            <span>Service</span><span>Stylist</span><span>Appointment</span><span className="text-right">Rate</span><span className="text-right">Commission</span><span />
          </div>
          <ul className="divide-y">{commissions.map((commission) => <CommissionRow key={commission.id} commission={commission} timeZone={timeZone} />)}</ul>
        </div>
      )}
    </PlatformPage>
  );
}

function CommissionRow({ commission, timeZone }: { commission: PlatformCommission; timeZone?: string }) {
  const appointment = commission.payment?.appointment;
  const clientName = appointment?.client?.displayName || (appointment ? appointmentContact({ metadata: appointment.metadata }).name : 'Walk-in');
  const appointmentZone = appointment?.location?.timezone || timeZone;
  const stylistName = commission.stylist?.user?.name || 'Unassigned';
  const appointmentId = commission.payment?.appointment?.id;

  return (
    <li className="grid min-w-0 gap-2 px-4 py-3 text-sm md:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_7rem_8rem] lg:items-center lg:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="truncate font-medium">{commission.service?.name || 'Service'}</span>
          <TitleStatus tone={commission.isPaid ? 'emerald' : 'amber'}>{commission.isPaid ? `Paid ${formatDate(commission.paidAt, timeZone)}` : 'Unpaid'}</TitleStatus>
        </div>
        <div className="text-xs text-muted-foreground">Sale {usd(commission.saleAmount)} · {commission.payment?.paymentMethod ? labelize(commission.payment.paymentMethod) : 'Unknown method'}</div>
      </div>
      <div className="min-w-0 truncate text-muted-foreground lg:text-foreground">{stylistName}</div>
      <div className="min-w-0 truncate text-muted-foreground">
        {appointmentId ? <Link href={`/dashboard/platform/appointments/${appointmentId}`} className="underline-offset-4 hover:underline">{formatDate(appointment?.startTime, appointmentZone)} · {clientName}</Link> : `${formatDate(appointment?.startTime, appointmentZone)} · ${clientName}`}
      </div>
      <div className="tabular-nums text-muted-foreground lg:text-right">{rate(commission.commissionRate)}</div>
      <div className="font-semibold tabular-nums lg:text-right">{usd(commission.commissionAmount)}</div>
      <div className="lg:text-right">
        {!commission.isPaid ? <PayoutForm action={markCommissionPaid} field="id" value={commission.id} label="Mark paid" amount={usd(commission.commissionAmount)} /> : null}
      </div>
    </li>
  );
}

export default CommissionOperationsPage;
