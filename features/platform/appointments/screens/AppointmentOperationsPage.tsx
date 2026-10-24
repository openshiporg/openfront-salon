import Link from 'next/link';
import { ArrowUpRight, CalendarDays, CalendarPlus, ReceiptText, ShieldAlert } from 'lucide-react';
import { appointmentContact } from '../../lib/appointmentContact';
import { RetryAppointmentQueueButton } from './RetryAppointmentQueueButton';
import { AppointmentActions } from './AppointmentActions';
import { lifecycleGates } from '../lib/lifecycleGates';
import { getAppointmentOperations, PlatformAppointment } from '../actions/appointments';
import {
  appointmentLabel,
  appointmentTone,
  Avatar,
  Chip,
  EmptyState,
  ErrorState,
  MetricStrip,
  PageHeader,
  PillLink,
  PlatformPage,
  SegmentTabs,
  TitleStatus,
  Track,
  usd,
  labelize,
} from '../../components/salon-ui';

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

function dayOf(value: string, timezone?: string | null) {
  return zoned(value, timezone, { weekday: 'short', month: 'short', day: 'numeric' });
}

function endOf(appointment: PlatformAppointment) {
  if (appointment.endTime) return appointment.endTime;
  const minutes = appointment.duration || appointment.services.reduce((sum, service) => sum + (service.baseDuration || 0), 0);
  return minutes ? new Date(new Date(appointment.startTime).getTime() + minutes * 60000).toISOString() : null;
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
  const result = await getAppointmentOperations(activeStatus);
  const counts = result.status === 'available' ? result.data.counts : null;
  const activeLabel = statusTabs.find((tab) => tab.value === activeStatus)?.label || 'Appointments';

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Appointments' }]}>
      <PageHeader
        icon={CalendarDays}
        title="Appointments"
        status={counts ? <TitleStatus tone={counts.pending > 0 ? 'amber' : 'emerald'}>{counts.pending > 0 ? `${counts.pending} to confirm` : 'All confirmed'}</TitleStatus> : null}
        actions={<Track><PillLink href="/dashboard/platform/appointments/new" variant="primary"><CalendarPlus />New appointment</PillLink></Track>}
      />

      {counts ? (
        <MetricStrip
          items={[
            { label: 'Today', value: counts.today, href: '/dashboard/platform/appointments' },
            { label: 'To confirm', value: counts.pending, tone: 'amber', href: '/dashboard/platform/appointments?status=pending' },
            { label: 'Confirmed', value: counts.confirmed, tone: 'emerald', href: '/dashboard/platform/appointments?status=confirmed' },
            { label: 'In chair', value: counts.in_progress, tone: 'blue', href: '/dashboard/platform/appointments?status=in_progress' },
            { label: 'No-shows', value: counts.no_show, tone: 'orange', href: '/dashboard/platform/appointments?status=no_show' },
          ]}
        />
      ) : null}

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
      ) : result.data.appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title={activeStatus === 'today' ? 'No appointments today' : `No ${activeLabel.toLowerCase()} appointments`} />
      ) : (
        <DaySheet appointments={result.data.appointments} showDay={activeStatus !== 'today'} />
      )}
    </PlatformPage>
  );
}

/** Appointments grouped by salon day, each row anchored to its start time. */
function DaySheet({ appointments, showDay }: { appointments: PlatformAppointment[]; showDay: boolean }) {
  const groups: Array<{ key: string; label: string; items: PlatformAppointment[] }> = [];
  for (const appointment of appointments) {
    const key = zoned(appointment.startTime, appointment.location?.timezone, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(appointment);
    else groups.push({ key, label: dayOf(appointment.startTime, appointment.location?.timezone), items: [appointment] });
  }

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="min-w-0">
          {showDay ? <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h2> : null}
          <ol className="divide-y overflow-hidden rounded-2xl border bg-background">
            {group.items.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: PlatformAppointment }) {
  const contact = appointmentContact(appointment);
  const timezone = appointment.location?.timezone;
  const end = endOf(appointment);
  const services = appointment.services.map((service) => service.name).filter(Boolean).join(' · ') || 'No services';
  const stylist = appointment.stylist?.user?.name || 'Unassigned';
  const tone = appointmentTone[appointment.status] || 'zinc';
  const closed = appointment.status === 'cancelled' || appointment.status === 'no_show';

  return (
    <li className={`grid min-w-0 gap-3 p-4 md:grid-cols-[6.5rem_minmax(0,1fr)_auto] md:items-start md:gap-5 md:p-5 ${closed ? 'bg-muted/20' : ''}`}>
      <div className="flex items-baseline gap-2 md:block">
        <div className={`text-base font-semibold tabular-nums ${closed ? 'text-muted-foreground line-through decoration-1' : ''}`}>{timeOf(appointment.startTime, timezone)}</div>
        <div className="text-xs tabular-nums text-muted-foreground">{end ? `– ${timeOf(end, timezone)}` : null}{appointment.duration ? ` · ${appointment.duration}m` : ''}</div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/dashboard/platform/appointments/${appointment.id}`} className="min-w-0 truncate text-base font-semibold hover:underline">{contact.name}</Link>
          <TitleStatus tone={tone}>{appointmentLabel[appointment.status] || appointment.status}</TitleStatus>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{services}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm"><Avatar name={stylist} className="size-6 text-[10px]" />{stylist}</span>
          <Chip>{usd(serviceTotal(appointment), { whole: true })}{appointment.payment?.status ? ` · ${labelize(appointment.payment.status)}` : ''}</Chip>
          {appointment.depositAmount ? <Chip tone={appointment.depositPaid ? 'emerald' : 'amber'}>{appointment.depositPaid ? 'Deposit paid' : `Deposit due ${usd(appointment.depositAmount, { whole: true })}`}</Chip> : null}
          {needsIntake(appointment) ? <Chip tone="violet"><ShieldAlert className="size-3" />Intake / consent</Chip> : null}
          {appointment.client?.totalVisits ? <Chip>{appointment.client.totalVisits} {appointment.client.totalVisits === 1 ? 'visit' : 'visits'}</Chip> : <Chip tone="sky">New client</Chip>}
        </div>
        {appointment.clientNotes || appointment.internalNotes ? (
          <div className="mt-3 grid gap-1 text-sm">
            {appointment.clientNotes ? <p className="text-muted-foreground"><span className="font-medium text-foreground">Client note · </span>{appointment.clientNotes}</p> : null}
            {appointment.internalNotes ? <p className="text-muted-foreground"><span className="font-medium text-foreground">Internal · </span>{appointment.internalNotes}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 justify-items-start gap-2 md:justify-items-end">
        <AppointmentActions id={appointment.id} status={appointment.status} size="sm" gates={lifecycleGates(appointment.startTime, timezone)} />
        <Track>
          <PillLink href={`/dashboard/platform/appointments/${appointment.id}`} size="sm" variant="quiet">Open<ArrowUpRight /></PillLink>
          {closed ? null : <PillLink href={`/dashboard/platform/checkout/${appointment.id}`} size="sm" variant="quiet"><ReceiptText />Checkout</PillLink>}
        </Track>
      </div>
    </li>
  );
}

export default AppointmentOperationsPage;
