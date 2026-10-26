import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getCommissionOperations, markCommissionPaid, markStylistCommissionsPaid, PlatformCommission } from '../actions/commissions';
import { DataTable, EmptyState, labelize, PageHeader, PlatformPage, SegmentTabs, StatusCell, Td, TitleStatus, usd } from '../../components/salon-ui';
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
  const ordered = [...summaries].sort((a, b) => (b.unpaidAmount + b.tipsOwed) - (a.unpaidAmount + a.tipsOwed));

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Commissions' }]}>
      <PageHeader
        title="Commissions"
        status={counts.unpaid > 0 ? <TitleStatus tone="amber">{usd(totals.unpaidAmount + totals.tipsOwed)} owed</TitleStatus> : null}
        meta={<span>{usd(totals.paidAmount + totals.tipsPaid)} paid out · {usd(totals.grossSales)} service sales</span>}
      />

      <section aria-labelledby="owed-by-stylist" className="grid gap-2">
        <h2 id="owed-by-stylist" className="text-sm font-semibold">Owed per stylist <span className="font-normal text-muted-foreground">since last payout</span></h2>
        <DataTable label="Owed per stylist" head={[{ label: 'Stylist' }, { label: 'Unpaid lines', className: 'hidden md:table-cell text-right' }, { label: 'Commission', className: 'text-right' }, { label: 'Card tips', className: 'hidden sm:table-cell text-right' }, { label: 'Total owed', className: 'text-right' }, { label: 'Paid to date', className: 'hidden lg:table-cell text-right' }, { label: 'Action', className: 'text-right' }]}>
          {ordered.length === 0 ? <tr><Td colSpan={7} className="py-4 text-muted-foreground">No commissions recorded yet.</Td></tr> : ordered.map((summary) => {
            const owed = summary.unpaidAmount + summary.tipsOwed;
            return (
              <tr key={summary.stylistId}>
                <Td className="font-medium">{summary.stylistId !== 'unassigned' ? <Link href={`/dashboard/platform/staff/${summary.stylistId}`} className="underline-offset-4 hover:underline">{summary.stylistName}</Link> : summary.stylistName}</Td>
                <Td className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{summary.unpaidCount}</Td>
                <Td className="text-right tabular-nums">{usd(summary.unpaidAmount)}</Td>
                <Td className="hidden text-right tabular-nums sm:table-cell">{usd(summary.tipsOwed)}</Td>
                <Td className={`text-right font-semibold tabular-nums ${owed > 0 ? '' : 'text-muted-foreground'}`}>{usd(owed)}</Td>
                <Td className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{usd(summary.paidAmount)}</Td>
                <Td className="text-right">{owed > 0 && summary.stylistId !== 'unassigned' ? <PayoutForm action={markStylistCommissionsPaid} field="stylistId" value={summary.stylistId} label="Pay out" amount={usd(owed)} /> : null}</Td>
              </tr>
            );
          })}
          {ordered.length > 1 ? (
            <tr className="bg-muted/30 font-semibold">
              <Td>Total</Td>
              <Td className="hidden text-right tabular-nums md:table-cell">{counts.unpaid}</Td>
              <Td className="text-right tabular-nums">{usd(totals.unpaidAmount)}</Td>
              <Td className="hidden text-right tabular-nums sm:table-cell">{usd(totals.tipsOwed)}</Td>
              <Td className="text-right tabular-nums">{usd(totals.unpaidAmount + totals.tipsOwed)}</Td>
              <Td className="hidden text-right tabular-nums lg:table-cell">{usd(totals.paidAmount)}</Td>
              <Td />
            </tr>
          ) : null}
        </DataTable>
      </section>

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
        <DataTable label="Commission lines" head={[{ label: 'Service' }, { label: 'Stylist', className: 'hidden sm:table-cell' }, { label: 'Appointment', className: 'hidden md:table-cell' }, { label: 'Rate', className: 'hidden lg:table-cell text-right' }, { label: 'Commission', className: 'text-right' }, { label: 'Status', className: 'hidden sm:table-cell' }, { label: 'Action', className: 'text-right' }]}>
          {commissions.map((commission) => <CommissionRow key={commission.id} commission={commission} timeZone={timeZone} />)}
        </DataTable>
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
    <tr>
      <Td>
        <span className="font-medium">{commission.service?.name || 'Service'}</span>
        <span className="block text-xs text-muted-foreground">Sale {usd(commission.saleAmount)} · {commission.payment?.paymentMethod ? labelize(commission.payment.paymentMethod) : 'Unknown method'}<span className="sm:hidden"> · {stylistName}</span></span>
        {/* Below sm the status column is hidden, so the status rides second, under the service. */}
        <span className="mt-1 block sm:hidden"><StatusCell tone={commission.isPaid ? 'emerald' : 'amber'}>{commission.isPaid ? `Paid ${formatDate(commission.paidAt, timeZone)}` : 'Unpaid'}</StatusCell></span>
      </Td>
      <Td className="hidden sm:table-cell">{stylistName}</Td>
      <Td className="hidden text-muted-foreground md:table-cell">
        {appointmentId ? <Link href={`/dashboard/platform/appointments/${appointmentId}`} className="underline-offset-4 hover:text-foreground hover:underline">{formatDate(appointment?.startTime, appointmentZone)} · {clientName}</Link> : `${formatDate(appointment?.startTime, appointmentZone)} · ${clientName}`}
      </Td>
      <Td className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{rate(commission.commissionRate)}</Td>
      <Td className="text-right font-semibold tabular-nums">{usd(commission.commissionAmount)}</Td>
      <Td className="hidden sm:table-cell"><StatusCell tone={commission.isPaid ? 'emerald' : 'amber'}>{commission.isPaid ? `Paid ${formatDate(commission.paidAt, timeZone)}` : 'Unpaid'}</StatusCell></Td>
      <Td className="text-right">{!commission.isPaid ? <PayoutForm action={markCommissionPaid} field="id" value={commission.id} label="Mark paid" amount={usd(commission.commissionAmount)} /> : null}</Td>
    </tr>
  );
}

export default CommissionOperationsPage;
