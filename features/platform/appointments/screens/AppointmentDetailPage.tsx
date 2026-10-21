import Link from 'next/link';
import { AppointmentRescheduleForm } from './AppointmentRescheduleForm';
import { appointmentContact } from '../../lib/appointmentContact';
import { formatSalonDateTime } from '@/features/lib/formatSalonDateTime';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, CreditCard, FileText, Package, ReceiptText, Scissors, UserRound, WalletCards } from 'lucide-react';
import { getAppointmentDetail, type AppointmentDetail } from '../actions/appointmentDetail';
import { AppointmentStatusForm } from './AppointmentStatusForm';
import { AppointmentCancelForm } from './AppointmentCancelForm';

interface PageProps { params: Promise<{ id: string }> }

const statusLabels: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
const statusClassNames: Record<string, string> = { pending: 'border-amber-200 bg-amber-50 text-amber-800', confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800', in_progress: 'border-blue-200 bg-blue-50 text-blue-800', completed: 'border-slate-200 bg-slate-50 text-slate-700', cancelled: 'border-rose-200 bg-rose-50 text-rose-800', no_show: 'border-zinc-300 bg-zinc-100 text-zinc-700' };

function money(cents?: number | null) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100); }
function date(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded'; }
function title(appointment: AppointmentDetail) { return appointment.services.map((service) => service.name).filter(Boolean).join(' · ') || appointment.lineItems.map((line) => line.serviceTitle).filter(Boolean).join(' · ') || 'Appointment'; }

export async function AppointmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getAppointmentDetail(id);
  if (!data.appointment) notFound();
  const { appointment, paymentBoundary, commissions, inventory, capabilities } = data;
  const contact = appointmentContact(appointment);
  const hasCheckout = Boolean(paymentBoundary?.payments.length || paymentBoundary?.sessions.length || paymentBoundary?.transactions.length);

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <nav aria-label="Appointment breadcrumbs" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/platform/appointments" className="inline-flex shrink-0 items-center gap-1 font-medium hover:text-foreground"><ArrowLeft className="h-4 w-4" />Appointments</Link>
          <span aria-hidden="true">/</span><span className="truncate">{title(appointment)}</span>
        </nav>

        <header className="rounded-2xl border bg-background p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassNames[appointment.status || ''] || 'bg-muted text-muted-foreground'}`}>{statusLabels[appointment.status || ''] || appointment.status || 'Unknown status'}</span>
                {appointment.depositAmount ? <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${appointment.depositPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{appointment.depositPaid ? `Deposit paid · ${money(appointment.depositAmount)}` : `Deposit due · ${money(appointment.depositAmount)}`}</span> : null}
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title(appointment)}</h1>
              <p className="mt-2 text-sm text-muted-foreground"><CalendarClock className="mr-1 inline h-4 w-4" />{appointment.startTime ? formatSalonDateTime(appointment.startTime, appointment.location?.timezone) : 'Not scheduled'} · {appointment.duration || 0} min · {appointment.location?.name || 'Location not assigned'}</p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-56 lg:grid-cols-1">
              {capabilities.appointments ? <AppointmentActions appointment={appointment} /> : null}
              {capabilities.payments && <Link href={`/dashboard/platform/checkout/${appointment.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"><CreditCard className="h-4 w-4" />{hasCheckout ? 'Review checkout' : 'Start checkout'}</Link>}
            </div>
          </div>
        </header>

        {capabilities.appointments && appointment.startTime && ["pending", "confirmed"].includes(appointment.status || "") ? <AppointmentRescheduleForm id={appointment.id} startTime={appointment.startTime} /> : null}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid min-w-0 gap-5">
            <Panel title="Visit details" icon={Scissors}>
              <div className="grid gap-3 sm:grid-cols-2">
                {appointment.services.map((service) => <div key={service.id} className="rounded-xl border bg-muted/20 p-3"><div className="font-medium">{service.name || 'Service'}</div><div className="mt-1 text-sm text-muted-foreground">{service.baseDuration || 0} min · {money(service.basePrice)}</div>{(service.requiresConsultation || service.requiresPatchTest) && <div className="mt-2 text-xs text-amber-800">{service.requiresConsultation ? 'Consultation required' : 'Patch test required'}</div>}</div>)}
                {!appointment.services.length && <Empty copy="No services on this appointment." />}
              </div>
              {appointment.lineItems.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border"><table className="min-w-[480px] w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Service</th><th className="px-3 py-2">Stylist</th><th className="px-3 py-2 text-right">Price</th></tr></thead><tbody>{appointment.lineItems.map((line) => <tr key={line.id} className="border-t"><td className="px-3 py-3">{line.serviceTitle || line.service?.name || 'Service'}</td><td className="px-3 py-3 text-muted-foreground">{line.staff?.user?.name || 'Unassigned'}</td><td className="px-3 py-3 text-right tabular-nums">{money(line.price)}</td></tr>)}</tbody></table></div>}
            </Panel>

            <Panel title="Payment" icon={WalletCards}>
              {!capabilities.payments ? <Restricted copy="You don't have access to payments." /> : !hasCheckout ? <Empty copy="Checkout not started." /> : <PaymentBoundary boundary={paymentBoundary!} integrations={capabilities.integrations} />}
            </Panel>

            {capabilities.commissions && commissions && <Panel title="Commissions" icon={ReceiptText}>{commissions.length ? <div className="grid gap-2">{commissions.map((commission) => <div key={commission.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 p-3 text-sm"><span>{commission.service?.name || 'Service'} · {commission.stylist?.user?.name || 'Unassigned'}</span><span className="font-medium tabular-nums">{money(commission.commissionAmount)} <span className="text-xs font-normal text-muted-foreground">{commission.isPaid ? 'paid' : 'unpaid'}</span></span></div>)}</div> : <Empty copy="No commissions for this appointment." />}</Panel>}
            {capabilities.inventory && inventory && <Panel title="Retail inventory movements" icon={Package}>{inventory.length ? <div className="grid gap-2">{inventory.map((movement) => <div key={movement.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 p-3 text-sm"><span>{movement.product?.name || 'Product'} · {movement.type || 'movement'}<span className="block text-xs text-muted-foreground">{movement.reason || 'No reason recorded'}</span></span><span className="tabular-nums">{movement.delta && movement.delta > 0 ? '+' : ''}{movement.delta || 0} <span className="text-xs text-muted-foreground">({movement.balanceBefore || 0} → {movement.balanceAfter || 0})</span></span></div>)}</div> : <Empty copy="No retail items sold with this appointment." />}</Panel>}
          </div>

          <aside className="grid content-start gap-5">
            <Panel title="Client" icon={UserRound}><div className="font-medium">{contact.name}</div><div className="mt-1 break-words text-sm text-muted-foreground">{contact.email || 'No email recorded'}{contact.phone ? ` · ${contact.phone}` : ''}</div><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><Fact label="Visits" value={String(appointment.client?.totalVisits || 0)} /><Fact label="Lifetime value" value={money(appointment.client?.lifetimeValue)} /></div></Panel>
            <Panel title="Stylist & resource" icon={Scissors}><div className="font-medium">{appointment.stylist?.user?.name || 'No stylist assigned'}</div><p className="mt-1 text-sm text-muted-foreground">{appointment.stylist?.tier ? `${appointment.stylist.tier} tier` : 'No tier recorded'}{appointment.resource?.name ? ` · ${appointment.resource.name}` : ''}</p></Panel>
            <Panel title="Notes" icon={FileText}>{appointment.clientNotes && <Note label="Client note" value={appointment.clientNotes} />}{appointment.internalNotes && <Note label="Internal note" value={appointment.internalNotes} />}{appointment.notes && <Note label="Visit note" value={appointment.notes} />}{!appointment.notes && !appointment.clientNotes && !appointment.internalNotes && <Empty copy="No notes recorded." />}</Panel>
            <Panel title="Lifecycle" icon={CalendarClock}><div className="grid gap-3 text-sm"><Fact label="Booked" value={date(appointment.bookedAt)} /><Fact label="Confirmed" value={date(appointment.confirmedAt)} />{(appointment.status === 'cancelled' || appointment.status === 'no_show') && <Fact label="Cancelled" value={date(appointment.cancelledAt)} />}{appointment.cancellationReason && <Note label="Reason" value={appointment.cancellationReason} />}</div></Panel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function AppointmentActions({ appointment }: { appointment: AppointmentDetail }) {
  if (appointment.status === 'cancelled' || appointment.status === 'completed' || appointment.status === 'no_show') return null;
  return <div className="grid gap-2">{appointment.status === 'pending' && <AppointmentStatusForm id={appointment.id} status="confirmed" label="Confirm appointment" primary />}{appointment.status === 'confirmed' && <AppointmentStatusForm id={appointment.id} status="in_progress" label="Check in" primary />}{(appointment.status === 'pending' || appointment.status === 'confirmed') && <AppointmentStatusForm id={appointment.id} status="no_show" label="Mark no-show" />}<AppointmentCancelForm id={appointment.id} variant="detail" cancellationReason="Cancelled from appointment detail" /></div>;
}
function PaymentBoundary({ boundary, integrations }: { boundary: NonNullable<Awaited<ReturnType<typeof getAppointmentDetail>>['paymentBoundary']>; integrations: boolean }) { return <div className="grid gap-4">{boundary.payments.map((payment) => <div key={payment.id} className="rounded-xl border bg-muted/20 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{payment.status || 'Payment'} · {payment.paymentMethod?.replaceAll('_', ' ') || 'Method not recorded'}</span><span className="font-semibold tabular-nums">{money(payment.totalAmount)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground"><span>Subtotal {money(payment.subtotal)}</span><span>Tax {money(payment.tax)}</span><span>Tip {money(payment.tip)}</span><span>Refunded {money(payment.refundedAmount)}</span></div>{payment.cardLast4 && <p className="mt-2 text-xs text-muted-foreground">{payment.cardBrand || 'Card'} ending {payment.cardLast4}</p>}</div>)}{boundary.transactions.map((transaction) => <div key={transaction.id} className="rounded-xl border bg-muted/20 p-3 text-sm"><div className="font-medium">Transaction {transaction.status || 'open'} · {transaction.paymentStatus || 'payment pending'}</div>{transaction.lineItems.map((line) => <div key={line.id} className="mt-2 flex justify-between gap-2 text-muted-foreground"><span>{line.service?.name || line.product?.name || line.itemType || 'Line item'} × {line.quantity || 1}</span><span>{money((line.unitPrice || 0) * (line.quantity || 1) - (line.discount || 0))}</span></div>)}</div>)}{boundary.sessions.length ? <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{boundary.sessions.length} controlled payment session{boundary.sessions.length === 1 ? '' : 's'} recorded. {integrations ? 'Provider configuration is managed in Integrations; secrets are never displayed here.' : 'Provider configuration remains restricted to Integrations.'}</div> : null}</div>; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof CalendarClock; children: React.ReactNode }) { return <section className="min-w-0 rounded-2xl border bg-background p-4 shadow-sm md:p-5"><h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Icon className="h-4 w-4 text-muted-foreground" />{title}</h2>{children}</section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 font-medium">{value}</div></div>; }
function Note({ label, value }: { label: string; value: string }) { return <div className="mb-3 last:mb-0"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p></div>; }
function Empty({ copy }: { copy: string }) { return <p className="text-sm text-muted-foreground">{copy}</p>; }
function Restricted({ copy }: { copy: string }) { return <p className="rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">{copy}</p>; }

export default AppointmentDetailPage;
