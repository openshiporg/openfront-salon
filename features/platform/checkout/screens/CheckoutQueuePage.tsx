import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarCheck, CalendarPlus, PackageCheck, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stackBodyClass, stackCellClass, stackHeadClass, stackRowClass, stackTableClass, stackThClass, stackWrapClass } from '../../appointments/lib/stackTable';
import { appointmentContact } from '../../lib/appointmentContact';
import { RetryCheckoutQueueButton } from './RetryCheckoutQueueButton';
import { CheckoutActionForm } from './CheckoutActionForm';
import { CheckoutLocalStock } from './CheckoutLocalStock';
import {
  calculateCheckoutTotals,
  CheckoutAppointment,
  completeAppointmentCheckout,
  getCheckoutQueue,
  getMembershipDiscountOptions,
  getPackageRedemptionOptions,
} from '../actions/checkout';
import {
  appointmentLabel,
  appointmentTone,
  Avatar,
  EmptyState,
  ErrorState,
  fieldLabelClass,
  inputClass,
  PageHeader,
  PillLink,
  PlatformPage,
  StatusCell,
  StatusDot,
  TitleStatus,
  Track,
  usd,
  labelize,
} from '../../components/salon-ui';

function zonedTime(value: string | null | undefined, timezone?: string | null) {
  if (!value) return 'Unscheduled';
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export async function CheckoutQueuePage() {
  const queue = await getCheckoutQueue();
  const appointments = queue.status === 'available' ? queue.data.appointments : [];
  const inChair = appointments.filter((appointment) => appointment.status === 'in_progress');
  const upcoming = appointments.filter((appointment) => appointment.status !== 'in_progress');

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Checkout' }]}>
      <PageHeader
        icon={ReceiptText}
        title="Checkout"
        status={queue.status === 'available' ? <TitleStatus tone={inChair.length ? 'blue' : appointments.length ? 'amber' : 'emerald'}>{inChair.length ? `${inChair.length} in chair` : appointments.length ? `${appointments.length} booked today` : 'Queue clear'}</TitleStatus> : null}
        actions={<Track><PillLink href="/dashboard/platform/appointments" variant="quiet"><CalendarCheck />Today&apos;s book</PillLink><PillLink href="/dashboard/platform/appointments/new"><CalendarPlus />Walk-in</PillLink></Track>}
      />

      {queue.status === 'unavailable' ? (
        <ErrorState
          id="checkout-queue-error-title"
          title="Checkout unavailable"
          message="The queue could not be verified, so appointments and counts are not shown as empty or zero. Check your access or connection, then retry."
          action={<RetryCheckoutQueueButton />}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No one to ring up today"
          action={<Track><PillLink href="/dashboard/platform/appointments?status=confirmed" variant="quiet">Confirmed appointments</PillLink><PillLink href="/dashboard/platform/appointments/new" variant="primary"><CalendarPlus />Book a walk-in</PillLink></Track>}
        />
      ) : (
        <>
          {inChair.length ? (
            <section aria-labelledby="checkout-in-chair" className="grid gap-3">
              <h2 id="checkout-in-chair" className="flex items-center gap-2 text-sm font-semibold"><StatusDot tone="blue" />In the chair</h2>
              {inChair.map((appointment) => <CheckoutWorkflowCard key={appointment.id} appointment={appointment} />)}
            </section>
          ) : null}
          {upcoming.length ? (
            <section aria-labelledby="checkout-later" className="grid gap-3">
              <h2 id="checkout-later" className="text-sm font-semibold">{inChair.length ? 'Later today' : 'Booked today'}</h2>
              <QueueTable appointments={upcoming} />
            </section>
          ) : null}
        </>
      )}
    </PlatformPage>
  );
}

function QueueTable({ appointments }: { appointments: CheckoutAppointment[] }) {
  return (
    <div className={stackWrapClass}>
      <table className={stackTableClass} aria-label="Booked today">
        <thead className={stackHeadClass}>
          <tr>
            {['Time', 'Client', 'Services', 'Stylist', 'Status'].map((label) => <th key={label} scope="col" className={stackThClass}>{label}</th>)}
            <th scope="col" className={cn(stackThClass, 'text-right')}>Est. due</th>
            <th scope="col" className={stackThClass}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className={stackBodyClass}>
          {appointments.map((appointment) => {
            const totals = calculateCheckoutTotals(appointment);
            const status = appointment.status || '';
            const paid = appointment.transaction?.status === 'completed' || appointment.payment?.status === 'completed';
            const services = appointment.services.map((service) => service.name).filter(Boolean).join(', ') || totals.lineItems.map((item) => item.serviceName).join(', ') || 'No services';
            return (
              <tr key={appointment.id} className={cn(stackRowClass, 'grid-cols-[4.75rem_minmax(0,1fr)_auto]')}>
                <td className={cn(stackCellClass, 'row-span-2 whitespace-nowrap font-semibold tabular-nums lg:w-24')}>{clockTime(appointment.startTime, appointment.location?.timezone)}</td>
                <td className={cn(stackCellClass, 'font-semibold')}><Link href={`/dashboard/platform/appointments/${appointment.id}`} className="block truncate underline-offset-4 hover:underline">{appointmentContact(appointment).name}</Link></td>
                <td className={cn(stackCellClass, 'col-start-2 row-start-2 truncate text-muted-foreground lg:max-w-64 lg:text-foreground')}>{services}<span className="lg:hidden"> · {appointment.stylist?.user?.name || 'Unassigned'}</span></td>
                <td className={cn(stackCellClass, 'hidden whitespace-nowrap lg:table-cell')}>{appointment.stylist?.user?.name || 'Unassigned'}</td>
                <td className={cn(stackCellClass, 'hidden lg:table-cell')}>{paid ? <StatusCell tone="emerald">Paid</StatusCell> : <StatusCell tone={appointmentTone[status] || 'zinc'}>{appointmentLabel[status] || labelize(status) || 'Appointment'}</StatusCell>}</td>
                <td className={cn(stackCellClass, 'col-start-3 row-start-1 text-right font-medium tabular-nums')}>{usd(paid ? appointment.payment?.totalAmount || 0 : totals.totalDue)}</td>
                <td className={cn(stackCellClass, 'col-start-3 row-start-2 text-right lg:w-px')}>
                  <PillLink href={`/dashboard/platform/checkout/${appointment.id}`} size="sm" variant={paid ? 'quiet' : 'raised'}>{paid ? 'View' : 'Ring up'}<ArrowUpRight /></PillLink>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function clockTime(value: string | null | undefined, timezone?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** The recorded ticket after payment: every service and retail line, then the totals that were charged. */
function PaidTicket({ appointment }: { appointment: CheckoutAppointment }) {
  const payment = appointment.payment!;
  const lines = appointment.transaction?.lineItems || [];
  return (
    <>
      <ul className="divide-y">
        {lines.map((line) => (
          <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-3 text-sm">
            <span className="min-w-0"><span className="block truncate font-medium">{line.service?.name || line.product?.name || labelize(line.itemType) || 'Item'}</span><span className="block truncate text-xs text-muted-foreground">{[line.product ? 'Retail' : line.staff?.user?.name, (line.quantity || 1) > 1 ? `× ${line.quantity}` : ''].filter(Boolean).join(' · ')}</span></span>
            <span className="tabular-nums">{usd((line.unitPrice || 0) * (line.quantity || 1))}</span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-1.5 border-t bg-muted/30 px-3 py-3 text-sm">
        <Row label="Subtotal" value={usd(payment.subtotal || 0)} />
        {payment.discount ? <Row label="Discount" value={`−${usd(payment.discount)}`} /> : null}
        <Row label="Tax" value={usd(payment.tax || 0)} />
        {payment.tip ? <Row label="Tip" value={usd(payment.tip)} /> : null}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"><dt className="font-semibold">Paid</dt><dd className="text-lg font-semibold tabular-nums">{usd(payment.totalAmount)}</dd></div>
      </dl>
    </>
  );
}

/** One salon ticket: services and staff on the left, payment capture on the right. */
export function CheckoutWorkflowCard({ appointment, retailPage, retailSearch = '', showClient = true }: { appointment: CheckoutAppointment; retailPage?: number; retailSearch?: string; showClient?: boolean }) {
  const totals = calculateCheckoutTotals(appointment);
  const clientName = appointmentContact(appointment).name;
  const stylistName = appointment.stylist?.user?.name || 'Unassigned';
  const alreadyCheckedOut = appointment.transaction?.status === 'completed' || appointment.payment?.status === 'completed';
  const packageOptions = getPackageRedemptionOptions(appointment);
  const membershipOptions = getMembershipDiscountOptions(appointment);
  const status = appointment.status || '';

  return (
    <article className="grid min-w-0 overflow-hidden rounded-[6px] border bg-background lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 p-4 md:p-5">
        {showClient ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Avatar name={clientName} />
            <h3 className="min-w-0 truncate text-base font-semibold">{clientName}</h3>
            {alreadyCheckedOut ? <TitleStatus tone="emerald">Paid</TitleStatus> : <TitleStatus tone={appointmentTone[status] || 'blue'}>{appointmentLabel[status] || labelize(status) || 'Appointment'}</TitleStatus>}
          </div>
        ) : null}
        <p className={showClient ? 'mt-1 text-sm text-muted-foreground' : 'text-sm text-muted-foreground'}>{zonedTime(appointment.startTime, appointment.location?.timezone)} · {appointment.duration || 60} min · {stylistName}</p>
        {appointment.depositPaid ? <p className="mt-2 text-xs text-muted-foreground">Deposit on file · applied at checkout</p> : null}

        <div className="mt-4 overflow-hidden rounded-[6px] border">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"><span>Ticket</span><span>Amount</span></div>
          {alreadyCheckedOut && appointment.payment ? <PaidTicket appointment={appointment} /> : <>
          <ul className="divide-y">
            {totals.lineItems.map((item) => (
              <li key={`${item.id}-${item.serviceId}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-3 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{item.serviceName}</span><span className="block truncate text-xs text-muted-foreground">{item.staffName}{item.quantity > 1 ? ` · × ${item.quantity}` : ''}</span></span>
                <span className="tabular-nums">{usd(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1.5 border-t bg-muted/30 px-3 py-3 text-sm">
            <Row label="Subtotal" value={usd(totals.subtotal)} />
            {membershipOptions.length > 0 ? <Row label={`${membershipOptions[0].membership?.name || 'Membership'} available`} value={`−${membershipOptions[0].membership?.discountPercent || 0}%`} /> : null}
            {packageOptions.length > 0 ? <Row label={`${packageOptions[0].package?.name || 'Package'} credit available`} value={usd(packageOptions[0].remainingValue)} /> : null}
            <Row label="Tax estimate" value={usd(totals.tax)} />
            {totals.depositCredit > 0 ? <Row label="Deposit credit" value={`−${usd(totals.depositCredit)}`} /> : null}
            {alreadyCheckedOut && appointment.payment ? (
              <>
                {appointment.payment.tip ? <Row label="Tip" value={usd(appointment.payment.tip)} /> : null}
                <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"><dt className="font-semibold">Paid</dt><dd className="text-lg font-semibold tabular-nums">{usd(appointment.payment.totalAmount)}</dd></div>
              </>
            ) : (
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"><dt className="font-semibold">Estimated due</dt><dd className="text-lg font-semibold tabular-nums">{usd(totals.totalDue)}</dd></div>
            )}
          </dl>
          </>}
        </div>
        <div className="mt-4">
          <Track><PillLink href={`/dashboard/platform/appointments/${appointment.id}`} size="sm" variant="quiet">Open appointment<ArrowUpRight /></PillLink></Track>
        </div>
      </div>

      <aside className="min-w-0 border-t bg-muted/20 p-4 md:p-5 lg:border-l lg:border-t-0">
        {alreadyCheckedOut ? (
          <div className="grid gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><TitleStatus tone="emerald">Payment recorded</TitleStatus></h3>
            <dl className="grid gap-1.5 text-sm">
              <Row label="Method" value={labelize(appointment.payment?.paymentMethod || appointment.transaction?.paymentMethod) || '—'} />
              {appointment.payment?.tax ? <Row label="Tax" value={usd(appointment.payment.tax)} /> : null}
              {appointment.payment?.discount ? <Row label="Discount" value={`−${usd(appointment.payment.discount)}`} /> : null}
              <Row label="Tip" value={usd(appointment.payment?.tip || 0)} />
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2"><dt className="font-semibold">Total</dt><dd className="font-semibold tabular-nums">{usd(appointment.payment?.totalAmount || 0)}</dd></div>
            </dl>
          </div>
        ) : (
        <CheckoutActionForm action={completeAppointmentCheckout} alreadyCheckedOut={alreadyCheckedOut}>
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <h3 className="text-sm font-semibold">Record payment</h3>
          <p className="mt-1 text-xs text-muted-foreground">Final total is confirmed on save.</p>
          <div className="mt-4 grid gap-3">
            <label className={fieldLabelClass}>
              Payment method
              <select name="paymentMethod" required defaultValue="" className={inputClass}>
                <option value="" disabled>Select collected payment</option>
                <option value="card">Card · external terminal</option>
                <option value="cash">Cash</option>
              </select>
            </label>
            {membershipOptions.length > 0 ? (
              <label className={fieldLabelClass}>
                Membership discount
                <select name="clientMembershipId" className={inputClass}>
                  <option value="">Do not apply</option>
                  {membershipOptions.map((option) => <option key={option.id} value={option.id}>{option.membership?.name || 'Membership'} · {option.membership?.discountPercent || 0}% off</option>)}
                </select>
              </label>
            ) : null}
            {packageOptions.length > 0 ? (
              <label className={fieldLabelClass}>
                Package credit
                <select name="clientPackageId" className={inputClass}>
                  <option value="">Do not redeem</option>
                  {packageOptions.map((option) => <option key={option.id} value={option.id}>{option.package?.name || 'Package'} · {usd(option.remainingValue)} left</option>)}
                </select>
              </label>
            ) : null}
            {membershipOptions.length > 0 || packageOptions.length > 0 ? <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><PackageCheck className="size-3.5" />Client benefits found</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput name="tip" label="Tip" />
              <MoneyInput name="discount" label="Discount" />
            </div>
            {retailPage !== undefined ? (
              <Suspense fallback={<p role="status" className="text-xs text-muted-foreground">Loading stock…</p>}><CheckoutLocalStock appointment={appointment} page={retailPage} search={retailSearch} /></Suspense>
            ) : (
              <Link href={`/dashboard/platform/checkout/${appointment.id}`} className="text-xs font-medium underline-offset-4 hover:underline">Add retail products</Link>
            )}
          </div>
        </CheckoutActionForm>
        )}
      </aside>
    </article>
  );
}

function MoneyInput({ name, label }: { name: string; label: string }) {
  return (
    <label className={fieldLabelClass}>
      {label}
      <span className="relative block">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <input name={name} type="number" min="0" step="0.01" placeholder="0.00" inputMode="decimal" className={`${inputClass} pl-7 tabular-nums`} />
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 text-muted-foreground"><dt className="min-w-0 truncate">{label}</dt><dd className="tabular-nums">{value}</dd></div>;
}

export default CheckoutQueuePage;
