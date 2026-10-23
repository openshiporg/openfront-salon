import { notFound } from 'next/navigation';
import { CalendarClock, CreditCard, FileText, Package, ReceiptText, Scissors, UserRound, WalletCards } from 'lucide-react';
import { AppointmentRescheduleForm } from './AppointmentRescheduleForm';
import { AppointmentActions } from './AppointmentActions';
import { appointmentContact } from '../../lib/appointmentContact';
import { formatSalonDateTime } from '@/features/lib/formatSalonDateTime';
import { getAppointmentDetail, type AppointmentDetail } from '../actions/appointmentDetail';
import {
  appointmentLabel,
  appointmentTone,
  Avatar,
  Chip,
  Fact,
  PageHeader,
  Panel,
  PillLink,
  PlatformPage,
  TitleStatus,
  Track,
  usd,
  labelize,
} from '../../components/salon-ui';

interface PageProps { params: Promise<{ id: string }> }

function stamp(value?: string | null, timeZone?: string | null) {
  return value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined }) : 'Not recorded';
}
/** Latest time the appointment moved into `status`, from its transition history. */
function transitionAt(metadata: unknown, status: string) {
  const history = metadata && typeof metadata === 'object' && Array.isArray((metadata as { transitionHistory?: unknown }).transitionHistory) ? (metadata as { transitionHistory: Array<{ to?: string; at?: string }> }).transitionHistory : [];
  return [...history].reverse().find((entry) => entry?.to === status)?.at || null;
}
function title(appointment: AppointmentDetail) { return appointment.services.map((service) => service.name).filter(Boolean).join(' · ') || appointment.lineItems.map((line) => line.serviceTitle).filter(Boolean).join(' · ') || 'Appointment'; }

export async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAppointmentDetail(id);
  if (!data.appointment) notFound();
  const { appointment, paymentBoundary, commissions, inventory, capabilities } = data;
  const contact = appointmentContact(appointment);
  const hasCheckout = Boolean(paymentBoundary?.payments.length || paymentBoundary?.sessions.length || paymentBoundary?.transactions.length);
  const status = appointment.status || '';
  const canReschedule = capabilities.appointments && appointment.startTime && ['pending', 'confirmed'].includes(status);

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Appointments', href: '/platform/appointments' }, { type: 'page', label: contact.name }]}>
      <PageHeader
        title={contact.name}
        status={<TitleStatus tone={appointmentTone[status] || 'zinc'}>{appointmentLabel[status] || status || 'Unknown status'}</TitleStatus>}
        meta={<>
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" />{appointment.startTime ? formatSalonDateTime(appointment.startTime, appointment.location?.timezone) : 'Not scheduled'}</span>
          <span>{appointment.duration || 0} min</span>
          <span>{appointment.location?.name || 'Location not assigned'}</span>
        </>}
        actions={capabilities.payments ? <Track><PillLink href={`/dashboard/platform/checkout/${appointment.id}`} variant="primary"><CreditCard />{hasCheckout ? 'Review checkout' : 'Start checkout'}</PillLink></Track> : null}
      />

      {capabilities.appointments ? <AppointmentActions id={appointment.id} status={status} cancellationReason="Cancelled from appointment detail" /> : null}

      <div className="flex flex-wrap gap-2">
        {appointment.depositAmount ? <Chip tone={appointment.depositPaid ? 'emerald' : 'amber'}>{appointment.depositPaid ? 'Deposit paid' : 'Deposit due'} · {usd(appointment.depositAmount)}</Chip> : null}
        {appointment.services.some((service) => service.requiresConsultation) ? <Chip tone="violet">Consultation required</Chip> : null}
        {appointment.services.some((service) => service.requiresPatchTest) ? <Chip tone="violet">Patch test required</Chip> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-5">
          <Panel title={title(appointment)} icon={Scissors} padded={false}>
            {appointment.lineItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="px-5 py-2.5 font-medium">Service</th><th className="px-5 py-2.5 font-medium">Stylist</th><th className="px-5 py-2.5 text-right font-medium">Price</th></tr></thead>
                  <tbody className="divide-y">{appointment.lineItems.map((line) => <tr key={line.id}><td className="px-5 py-3 font-medium">{line.serviceTitle || line.service?.name || 'Service'}</td><td className="px-5 py-3 text-muted-foreground">{line.staff?.user?.name || 'Unassigned'}</td><td className="px-5 py-3 text-right tabular-nums">{usd(line.price)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : appointment.services.length ? (
              <ul className="divide-y">{appointment.services.map((service) => <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><span className="font-medium">{service.name || 'Service'}</span><span className="tabular-nums text-muted-foreground">{service.baseDuration || 0} min · {usd(service.basePrice)}</span></li>)}</ul>
            ) : <p className="p-5 text-sm text-muted-foreground">No services on this appointment.</p>}
          </Panel>

          {canReschedule ? <Panel title="Reschedule" icon={CalendarClock}><AppointmentRescheduleForm id={appointment.id} startTime={appointment.startTime!} timeZone={appointment.location?.timezone} /></Panel> : null}

          <Panel title="Payment" icon={WalletCards}>
            {!capabilities.payments ? <p className="text-sm text-muted-foreground">You don&apos;t have access to payments.</p> : !hasCheckout ? <p className="text-sm text-muted-foreground">Checkout not started.</p> : <PaymentBoundary boundary={paymentBoundary!} integrations={capabilities.integrations} />}
          </Panel>

          {capabilities.commissions && commissions ? (
            <Panel title="Commissions" icon={ReceiptText} padded={false}>
              {commissions.length ? <ul className="divide-y">{commissions.map((commission) => <li key={commission.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span className="min-w-0">{commission.service?.name || 'Service'} <span className="text-muted-foreground">· {commission.stylist?.user?.name || 'Unassigned'}</span></span><span className="inline-flex items-center gap-3"><TitleStatus tone={commission.isPaid ? 'emerald' : 'amber'}>{commission.isPaid ? 'Paid' : 'Unpaid'}</TitleStatus><span className="font-medium tabular-nums">{usd(commission.commissionAmount)}</span></span></li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">No commissions for this appointment.</p>}
            </Panel>
          ) : null}

          {capabilities.inventory && inventory ? (
            <Panel title="Retail sold" icon={Package} padded={false}>
              {inventory.length ? <ul className="divide-y">{inventory.map((movement) => <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span className="min-w-0">{movement.product?.name || 'Product'} <span className="text-muted-foreground">· {labelize(movement.type) || 'Movement'}</span><span className="block text-xs text-muted-foreground">{movement.reason || 'No reason recorded'}</span></span><span className="tabular-nums">{movement.delta && movement.delta > 0 ? '+' : ''}{movement.delta || 0} <span className="text-xs text-muted-foreground">({movement.balanceBefore || 0} → {movement.balanceAfter || 0})</span></span></li>)}</ul> : <p className="p-5 text-sm text-muted-foreground">No retail items sold with this appointment.</p>}
            </Panel>
          ) : null}
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <Panel title="Client" icon={UserRound}>
            <div className="flex items-center gap-3"><Avatar name={contact.name} /><div className="min-w-0"><div className="truncate font-medium">{contact.name}</div><div className="truncate text-sm text-muted-foreground">{contact.email || 'No email recorded'}</div></div></div>
            {contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="mt-3 block text-sm font-medium underline-offset-4 hover:underline">{contact.phone}</a> : null}
            <dl className="mt-4 grid grid-cols-2 gap-3"><Fact label="Visits">{String(appointment.client?.totalVisits || 0)}</Fact><Fact label="Lifetime value">{usd(appointment.client?.lifetimeValue)}</Fact></dl>
          </Panel>
          <Panel title="Stylist & station" icon={Scissors}>
            <div className="flex items-center gap-3"><Avatar name={appointment.stylist?.user?.name} /><div className="min-w-0"><div className="truncate font-medium">{appointment.stylist?.user?.name || 'No stylist assigned'}</div><div className="truncate text-sm text-muted-foreground">{appointment.stylist?.tier ? `${labelize(appointment.stylist.tier)} tier` : 'No tier recorded'}{appointment.resource?.name ? ` · ${appointment.resource.name}` : ''}</div></div></div>
          </Panel>
          <Panel title="Notes" icon={FileText}>
            <div className="grid gap-3">
              {appointment.clientNotes ? <Note label="Client note" value={appointment.clientNotes} /> : null}
              {appointment.internalNotes ? <Note label="Internal note" value={appointment.internalNotes} /> : null}
              {appointment.notes ? <Note label="Visit note" value={appointment.notes} /> : null}
              {!appointment.notes && !appointment.clientNotes && !appointment.internalNotes ? <p className="text-sm text-muted-foreground">No notes recorded.</p> : null}
            </div>
          </Panel>
          <Panel title="Lifecycle" icon={CalendarClock}>
            <dl className="grid gap-3">
              <Fact label="Booked">{stamp(appointment.bookedAt, appointment.location?.timezone)}</Fact>
              <Fact label="Confirmed">{stamp(appointment.confirmedAt || transitionAt(appointment.metadata, 'confirmed'), appointment.location?.timezone)}</Fact>
              {transitionAt(appointment.metadata, 'in_progress') ? <Fact label="Checked in">{stamp(transitionAt(appointment.metadata, 'in_progress'), appointment.location?.timezone)}</Fact> : null}
              {transitionAt(appointment.metadata, 'completed') || status === 'completed' ? <Fact label="Completed">{stamp(transitionAt(appointment.metadata, 'completed'), appointment.location?.timezone)}</Fact> : null}
              {status === 'no_show' ? <Fact label="No-show">{stamp(transitionAt(appointment.metadata, 'no_show'), appointment.location?.timezone)}</Fact> : null}
              {status === 'cancelled' ? <Fact label="Cancelled">{stamp(appointment.cancelledAt, appointment.location?.timezone)}</Fact> : null}
            </dl>
            {appointment.cancellationReason ? <div className="mt-3"><Note label="Reason" value={appointment.cancellationReason} /></div> : null}
          </Panel>
        </aside>
      </div>
    </PlatformPage>
  );
}

function PaymentBoundary({ boundary, integrations }: { boundary: NonNullable<Awaited<ReturnType<typeof getAppointmentDetail>>['paymentBoundary']>; integrations: boolean }) {
  return (
    <div className="grid gap-3">
      {boundary.payments.map((payment) => (
        <div key={payment.id} className="rounded-xl border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><TitleStatus tone={payment.status === 'completed' ? 'emerald' : 'amber'}>{labelize(payment.status) || 'Payment'} · {labelize(payment.paymentMethod) || 'Method not recorded'}</TitleStatus><span className="font-semibold tabular-nums">{usd(payment.totalAmount)}</span></div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Fact label="Subtotal">{usd(payment.subtotal)}</Fact><Fact label="Tax">{usd(payment.tax)}</Fact><Fact label="Tip">{usd(payment.tip)}</Fact><Fact label="Refunded">{usd(payment.refundedAmount)}</Fact></dl>
          {payment.cardLast4 ? <p className="mt-2 text-xs text-muted-foreground">{payment.cardBrand || 'Card'} ending {payment.cardLast4}</p> : null}
        </div>
      ))}
      {boundary.transactions.map((transaction) => (
        <div key={transaction.id} className="rounded-xl border p-3 text-sm">
          <div className="font-medium">Transaction {transaction.status || 'open'} · {transaction.paymentStatus || 'payment pending'}</div>
          {transaction.lineItems.map((line) => <div key={line.id} className="mt-2 flex justify-between gap-2 text-muted-foreground"><span>{line.service?.name || line.product?.name || line.itemType || 'Line item'} × {line.quantity || 1}</span><span className="tabular-nums">{usd((line.unitPrice || 0) * (line.quantity || 1) - (line.discount || 0))}</span></div>)}
        </div>
      ))}
      {boundary.sessions.length ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{boundary.sessions.length} payment session{boundary.sessions.length === 1 ? '' : 's'} recorded.{integrations ? ' Provider settings live in Integrations.' : ''}</p> : null}
    </div>
  );
}

function Note({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium text-muted-foreground">{label}</div><p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p></div>;
}

export default AppointmentDetailPage;
