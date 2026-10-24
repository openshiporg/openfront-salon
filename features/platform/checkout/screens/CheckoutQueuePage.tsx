import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarCheck, PackageCheck, ReceiptText } from 'lucide-react';
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
  const count = queue.status === 'available' ? queue.data.appointments.length : null;

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Checkout' }]}>
      <PageHeader
        icon={ReceiptText}
        title="Checkout"
        status={count !== null ? <TitleStatus tone={count > 0 ? 'blue' : 'emerald'}>{count > 0 ? `${count} ready to pay` : 'Queue clear'}</TitleStatus> : null}
      />

      {queue.status === 'unavailable' ? (
        <ErrorState
          id="checkout-queue-error-title"
          title="Checkout unavailable"
          message="The queue could not be verified, so appointments and counts are not shown as empty or zero. Check your access or connection, then retry."
          action={<RetryCheckoutQueueButton />}
        />
      ) : queue.data.appointments.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No appointments ready for checkout" action={<Track><PillLink href="/dashboard/platform/appointments?status=confirmed">Confirmed appointments</PillLink></Track>} />
      ) : (
        <div className="grid gap-5">
          {queue.data.appointments.map((appointment) => (
            <CheckoutWorkflowCard key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </PlatformPage>
  );
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
export function CheckoutWorkflowCard({ appointment, retailPage, retailSearch = '' }: { appointment: CheckoutAppointment; retailPage?: number; retailSearch?: string }) {
  const totals = calculateCheckoutTotals(appointment);
  const clientName = appointmentContact(appointment).name;
  const stylistName = appointment.stylist?.user?.name || 'Unassigned';
  const alreadyCheckedOut = appointment.transaction?.status === 'completed' || appointment.payment?.status === 'completed';
  const packageOptions = getPackageRedemptionOptions(appointment);
  const membershipOptions = getMembershipDiscountOptions(appointment);
  const status = appointment.status || '';

  return (
    <article className="grid min-w-0 overflow-hidden rounded-2xl border bg-background xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Avatar name={clientName} />
          <h2 className="min-w-0 truncate text-lg font-semibold">{clientName}</h2>
          {alreadyCheckedOut ? <TitleStatus tone="emerald">Paid</TitleStatus> : <TitleStatus tone={appointmentTone[status] || 'blue'}>{appointmentLabel[status] || labelize(status) || 'Appointment'}</TitleStatus>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{zonedTime(appointment.startTime, appointment.location?.timezone)} · {appointment.duration || 60} min · {stylistName}</p>
        {appointment.depositPaid ? <p className="mt-2 text-xs text-muted-foreground">Deposit on file · applied at checkout</p> : null}

        <div className="mt-4 rounded-xl border">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground"><span>Ticket</span><span>Amount</span></div>
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

      <aside className="min-w-0 border-t bg-muted/20 p-4 md:p-5 xl:border-l xl:border-t-0">
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
