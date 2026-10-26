import Link from 'next/link';
import { ArrowUpRight, CalendarDays, CalendarPlus, ReceiptText, ShieldAlert } from 'lucide-react';
import { appointmentContact } from '../../lib/appointmentContact';
import { getSalonTimezone } from '../../lib/salonTimezone';
import { RetryAppointmentQueueButton } from './RetryAppointmentQueueButton';
import { AppointmentActions } from './AppointmentActions';
import { DayBoard, appointmentEnd } from './DayBoard';
import { lifecycleGates } from '../lib/lifecycleGates';
import { stackBodyClass, stackCellClass, stackHeadClass, stackRowClass, stackTableClass, stackThClass, stackWrapClass } from '../lib/stackTable';
import { getAppointmentOperations, PlatformAppointment } from '../actions/appointments';
import {
  appointmentLabel,
  appointmentTone,
  EmptyState,
  ErrorState,
  PageHeader,
  PillLink,
  PlatformPage,
  SegmentTabs,
  StatusCell,
  StatusDot,
  TitleStatus,
  Track,
  usd,
  labelize,
} from '../../components/salon-ui';
import { cn } from '@/lib/utils';

const statusTabs = [
  { value: 'today', label: 'Today' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In chair' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-shows' },
  { value: 'all', label: 'All' },
] as const;

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

function zoned(value: string, timezone: string | null | undefined, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', ...options }).format(new Date(value));
}

function timeOf(value: string, timezone?: string | null) {
  return zoned(value, timezone, { hour: 'numeric', minute: '2-digit' });
}

function serviceTotal(appointment: PlatformAppointment) {
  if (appointment.lineItems.length) return appointment.lineItems.reduce((sum, item) => sum + (item.price || 0), 0);
  return appointment.services.reduce((sum, service) => sum + (service.basePrice || 0), 0);
}

function needsIntake(appointment: PlatformAppointment) {
  return appointment.services.some((service) => service.requiresPatchTest || service.requiresConsultation);
}

export async function AppointmentOperationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = resolvedSearchParams.status || 'today';
  const [result, salonZone] = await Promise.all([getAppointmentOperations(activeStatus), getSalonTimezone()]);
  const counts = result.status === 'available' ? result.data.counts : null;
  const activeLabel = statusTabs.find((tab) => tab.value === activeStatus)?.label || 'Appointments';
  const appointments = result.status === 'available' ? result.data.appointments : [];
  const isToday = activeStatus === 'today';
  const boardZone = appointments[0]?.location?.timezone || salonZone || 'UTC';
  const now = new Date();
  const next = isToday ? appointments.find((appointment) => ['pending', 'confirmed'].includes(appointment.status) && new Date(appointment.startTime).getTime() >= now.getTime()) : undefined;
  const inChair = isToday ? appointments.filter((appointment) => appointment.status === 'in_progress').length : 0;

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Appointments' }]}>
      <PageHeader
        icon={CalendarDays}
        title="Appointments"
        status={counts ? <TitleStatus tone={counts.pending > 0 ? 'amber' : 'emerald'}>{counts.pending > 0 ? `${counts.pending} to confirm` : 'All confirmed'}</TitleStatus> : null}
        meta={isToday && result.status === 'available' ? <>
          <span className="tabular-nums">{zoned(now.toISOString(), boardZone, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          {next ? <span>Next: <Link href={`/dashboard/platform/appointments/${next.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">{timeOf(next.startTime, boardZone)} {appointmentContact(next).name}</Link></span> : null}
          {inChair ? <span className="inline-flex items-center gap-1.5"><StatusDot tone="blue" />{inChair} in chair</span> : null}
        </> : null}
        actions={<Track><PillLink href="/dashboard/platform/appointments/new" variant="primary"><CalendarPlus />New appointment</PillLink></Track>}
      />

      <SegmentTabs
        label="Appointment status filters"
        active={activeStatus}
        tabs={statusTabs.map((tab) => ({
          value: tab.value,
          label: tab.label,
          href: tab.value === 'today' ? '/dashboard/platform/appointments' : `/dashboard/platform/appointments?status=${tab.value}`,
          count: counts ? counts[tab.value as keyof typeof counts] : null,
        }))}
      />

      {result.status === 'unavailable' ? (
        <ErrorState
          id="appointment-queue-error-title"
          title="Appointment queue unavailable"
          message="Appointments and counts could not be verified, so this view is not shown as empty or zero. Check your access or connection, then retry."
          action={<RetryAppointmentQueueButton />}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={isToday ? 'No appointments today' : `No ${activeLabel.toLowerCase()} appointments`}
          action={<Track>
            {isToday && counts && counts.all > 0 ? <PillLink href="/dashboard/platform/appointments?status=all" variant="quiet">All appointments<span className="tabular-nums text-muted-foreground">{counts.all}</span></PillLink> : null}
            <PillLink href="/dashboard/platform/appointments/new"><CalendarPlus />Book a client</PillLink>
          </Track>}
        />
      ) : (
        <>
          {isToday ? <DayBoard appointments={appointments} timeZone={boardZone} now={now} /> : null}
          <AppointmentTable appointments={appointments} showDay={!isToday} />
        </>
      )}
    </PlatformPage>
  );
}

function AppointmentTable({ appointments, showDay }: { appointments: PlatformAppointment[]; showDay: boolean }) {
  return (
    <div className={stackWrapClass}>
      <table className={stackTableClass} aria-label="Appointments">
        <thead className={stackHeadClass}>
          <tr>
            {['Time', 'Client', 'Services', 'Stylist', 'Status', 'Flags'].map((label) => <th key={label} scope="col" className={stackThClass}>{label}</th>)}
            <th scope="col" className={cn(stackThClass, 'text-right')}>Total</th>
            <th scope="col" className={stackThClass}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className={stackBodyClass}>
          {appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} showDay={showDay} />)}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentRow({ appointment, showDay }: { appointment: PlatformAppointment; showDay: boolean }) {
  const contact = appointmentContact(appointment);
  const timezone = appointment.location?.timezone;
  const end = appointmentEnd(appointment);
  const services = appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'No services';
  const stylist = appointment.stylist?.user?.name || 'Unassigned';
  const tone = appointmentTone[appointment.status] || 'zinc';
  const closed = appointment.status === 'cancelled' || appointment.status === 'no_show';
  const visits = appointment.client?.totalVisits || 0;
  const href = `/dashboard/platform/appointments/${appointment.id}`;
  const notes = [appointment.clientNotes ? `Client: ${appointment.clientNotes}` : '', appointment.internalNotes ? `Internal: ${appointment.internalNotes}` : ''].filter(Boolean).join(' · ');

  return (
    <tr className={cn(stackRowClass, 'grid-cols-[4.75rem_minmax(0,1fr)]', closed && 'bg-muted/20')}>
      <td className={cn(stackCellClass, 'row-span-4 whitespace-nowrap lg:w-28')}>
        {showDay ? <div className="text-xs text-muted-foreground">{zoned(appointment.startTime, timezone, { weekday: 'short', month: 'short', day: 'numeric' })}</div> : null}
        <div className={cn('font-semibold tabular-nums', closed && 'text-muted-foreground line-through decoration-1')}>{timeOf(appointment.startTime, timezone)}</div>
        <div className="text-xs tabular-nums text-muted-foreground">– {timeOf(end, timezone)}</div>
      </td>
      <td className={cn(stackCellClass, 'lg:min-w-40')}>
        <Link href={href} className="block truncate font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">{contact.name}</Link>
        <div className="text-xs text-muted-foreground">{visits ? `${visits} ${visits === 1 ? 'visit' : 'visits'}` : <span className="inline-flex items-center gap-1"><StatusDot tone="sky" className="size-1.5" />New client</span>}</div>
      </td>
      <td className={cn(stackCellClass, 'lg:max-w-64')}>
        <div className="truncate">{services}</div>
        {notes ? <div className="truncate text-xs text-muted-foreground" title={notes}>{notes}</div> : null}
        <div className="text-xs text-muted-foreground lg:hidden">{stylist}</div>
      </td>
      <td className={cn(stackCellClass, 'hidden whitespace-nowrap lg:table-cell')}>{stylist}</td>
      <td className={cn(stackCellClass, 'flex flex-wrap items-center gap-x-3 gap-y-1 lg:table-cell')}>
        <StatusCell tone={tone}>{appointmentLabel[appointment.status] || labelize(appointment.status)}</StatusCell>
        <span className="text-xs tabular-nums text-muted-foreground lg:hidden">{usd(serviceTotal(appointment), { whole: true })}</span>
      </td>
      <td className={cn(stackCellClass, 'text-xs empty:hidden lg:empty:table-cell')}>
        {appointment.depositAmount || needsIntake(appointment) ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 lg:grid lg:gap-0.5">
            {appointment.depositAmount ? <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', !appointment.depositPaid && 'font-medium text-amber-800 dark:text-amber-300')}><StatusDot tone={appointment.depositPaid ? 'emerald' : 'amber'} className="size-1.5" />{appointment.depositPaid ? 'Deposit paid' : `Deposit due ${usd(appointment.depositAmount, { whole: true })}`}</span> : null}
            {needsIntake(appointment) ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-violet-800 dark:text-violet-300"><ShieldAlert className="size-3" />Intake / consent</span> : null}
          </div>
        ) : null}
      </td>
      <td className={cn(stackCellClass, 'hidden text-right tabular-nums lg:table-cell')}>
        <div className="font-medium">{usd(serviceTotal(appointment), { whole: true })}</div>
        {appointment.payment?.status ? <div className="text-xs text-muted-foreground">{labelize(appointment.payment.status)}</div> : null}
      </td>
      <td className={cn(stackCellClass, 'col-span-2 pt-1 lg:w-px lg:pt-2')}>
        <div className="flex flex-wrap items-start gap-1.5 lg:flex-nowrap lg:justify-end">
          <AppointmentActions id={appointment.id} status={appointment.status} size="sm" gates={lifecycleGates(appointment.startTime, timezone)} />
          <Track className="flex-nowrap">
            <PillLink href={href} size="sm" variant="quiet">Open<ArrowUpRight /></PillLink>
            {closed ? null : <PillLink href={`/dashboard/platform/checkout/${appointment.id}`} size="sm" variant="quiet"><ReceiptText />Checkout</PillLink>}
          </Track>
        </div>
      </td>
    </tr>
  );
}

export default AppointmentOperationsPage;
