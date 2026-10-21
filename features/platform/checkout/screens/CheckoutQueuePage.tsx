import { Suspense, type ComponentType } from 'react';
import Link from 'next/link';
import { appointmentContact } from '../../lib/appointmentContact';
import { formatSalonDateTime } from '@/features/lib/formatSalonDateTime';
import { RetryCheckoutQueueButton } from './RetryCheckoutQueueButton';
import { CheckoutActionForm } from './CheckoutActionForm';
import { CheckoutLocalStock } from './CheckoutLocalStock';
import { CalendarCheck, CreditCard, PackageCheck, ReceiptText, Scissors, Sparkles } from 'lucide-react';
import {
  calculateCheckoutTotals,
  CheckoutAppointment,
  completeAppointmentCheckout,
  getCheckoutQueue,
  getMembershipDiscountOptions,
  getPackageRedemptionOptions,
} from '../actions/checkout';

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export async function CheckoutQueuePage() {
  const queue = await getCheckoutQueue();

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <ReceiptText className="h-3.5 w-3.5" />
                POS / checkout
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Checkout</h1>

            </div>

          </div>
        </header>

        {queue.status === 'unavailable' ? (
          <section role="alert" aria-labelledby="checkout-queue-error-title" className="rounded-2xl border border-amber-300 bg-amber-50 p-8 shadow-sm">
            <h2 id="checkout-queue-error-title" className="text-lg font-semibold">Checkout unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm text-amber-950">
              The queue could not be verified, so appointments and counts are not shown as empty or zero. Check your access or connection, then retry.
            </p>
            <RetryCheckoutQueueButton />
          </section>
        ) : queue.data.appointments.length === 0 ? (
          <section className="rounded-2xl border bg-background p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No appointments ready for checkout</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Check in a confirmed appointment to start checkout.
            </p>
          </section>
        ) : (
          <section className="grid gap-4">
            {queue.data.appointments.map((appointment) => (
              <CheckoutWorkflowCard key={appointment.id} appointment={appointment} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}


export function CheckoutWorkflowCard({ appointment, retailPage, retailSearch = '' }: { appointment: CheckoutAppointment; retailPage?: number; retailSearch?: string }) {
  const totals = calculateCheckoutTotals(appointment);
  const clientName = appointmentContact(appointment).name;
  const stylistName = appointment.stylist?.user?.name || 'Unassigned';
  const alreadyCheckedOut = appointment.transaction?.status === 'completed' || appointment.payment?.status === 'completed';
  const packageOptions = getPackageRedemptionOptions(appointment);
  const membershipOptions = getMembershipDiscountOptions(appointment);

  return (
    <article className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
              {appointment.status?.replaceAll('_', ' ') || 'appointment'}
            </span>
            {appointment.depositPaid && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                Deposit payment on file · retained credit verified at checkout
              </span>
            )}
            {alreadyCheckedOut && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                Paid
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold tracking-tight">{clientName}</h2>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <Info icon={CalendarCheck} label="When" value={appointment.startTime ? formatSalonDateTime(appointment.startTime, appointment.location?.timezone) : 'Unscheduled'} subvalue={`${appointment.duration || 60} min`} />
            <Info icon={Scissors} label="Provider" value={stylistName} />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1fr_auto_auto] bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Line item</span>
              <span>Staff</span>
              <span className="text-right">Amount</span>
            </div>
            {totals.lineItems.map((item) => (
              <div key={`${item.id}-${item.serviceId}`} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t px-3 py-3 text-sm">
                <span className="font-medium">{item.serviceName}</span>
                <span className="text-muted-foreground">{item.staffName}</span>
                <span className="text-right tabular-nums">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="grid gap-1 border-t bg-muted/20 px-3 py-3 text-sm">
              <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
              {membershipOptions.length > 0 && (
                <SummaryRow
                  label={`${membershipOptions[0].membership?.name || 'Membership'} discount available`}
                  value={`-${membershipOptions[0].membership?.discountPercent || 0}%`}
                />
              )}
              {packageOptions.length > 0 && (
                <SummaryRow
                  label={`${packageOptions[0].package?.name || 'Package'} credit available`}
                  value={formatCurrency(packageOptions[0].remainingValue)}
                />
              )}
              <SummaryRow label="Tax estimate" value={formatCurrency(totals.tax)} />
              {totals.depositCredit > 0 && <SummaryRow label="Deposit credit" value={`-${formatCurrency(totals.depositCredit)}`} />}
              <SummaryRow label="Estimate before selected adjustments" value={formatCurrency(totals.totalDue)} strong />
            </div>
          </div>
        </div>

        <aside className="xl:w-80">
          <CheckoutActionForm action={completeAppointmentCheckout} alreadyCheckedOut={alreadyCheckedOut}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <div className="text-sm font-semibold">Record collected payment</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Estimated total. The final total, including memberships, packages, and deposits, is confirmed when you record payment. Record card payments taken on your terminal.</p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payment method
                <select name="paymentMethod" required defaultValue="" className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring">
                  <option value="" disabled>Select collected payment</option>
                  <option value="card">External card terminal (already collected)</option>
                  <option value="cash">Cash collected</option>
                </select>
              </label>
              {membershipOptions.length > 0 && (
                <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Membership discount
                  <select name="clientMembershipId" className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Do not apply</option>
                    {membershipOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.membership?.name || 'Membership'} · {option.membership?.discountPercent || 0}% off
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {packageOptions.length > 0 && (
                <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Package credit
                  <select name="clientPackageId" className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Do not redeem</option>
                    {packageOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.package?.name || 'Package'} · {formatCurrency(option.remainingValue)} left
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {retailPage !== undefined ? <Suspense fallback={<p role="status" className="text-xs">Loading stock…</p>}><CheckoutLocalStock appointment={appointment} page={retailPage} search={retailSearch} /></Suspense> : <Link href={`/dashboard/platform/checkout/${appointment.id}`} className="text-xs underline">Open checkout detail to select retail items</Link>}
              {(membershipOptions.length > 0 || packageOptions.length > 0) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <div className="mb-1 flex items-center gap-1.5 font-semibold">
                    <PackageCheck className="h-3.5 w-3.5" />
                    Benefits found
                  </div>
                  Apply an active membership or package before taking payment.
                </div>
              )}
              <MoneyInput name="tip" label="Tip" />
              <MoneyInput name="discount" label="Discount" />
            </div>
          </CheckoutActionForm>
          <Link href={`/dashboard/platform/appointments/${appointment.id}`} className="mt-3 inline-flex w-full items-center justify-center rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            Open appointment
          </Link>
        </aside>
      </div>
    </article>
  );
}

function MoneyInput({ name, label }: { name: string; label: string }) {
  return (
    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label} cents
      <input name={name} type="number" min="0" step="100" defaultValue="0" className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Info({ icon: Icon, label, value, subvalue }: { icon: ComponentType<{ className?: string }>; label: string; value: string; subvalue?: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{label}</div>
        <div className="truncate font-medium text-foreground">{value}</div>
        {subvalue && <div className="truncate text-xs text-muted-foreground">{subvalue}</div>}
      </div>
    </div>
  );
}

export default CheckoutQueuePage;
