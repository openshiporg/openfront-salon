import type { ComponentType } from 'react';
import Link from 'next/link';
import { appointmentContact } from '../../lib/appointmentContact';
import { formatSalonDateTime } from '@/features/lib/formatSalonDateTime';
import { RetryAppointmentQueueButton } from './RetryAppointmentQueueButton';
import { AppointmentStatusForm } from './AppointmentStatusForm';
import { AppointmentCancelForm } from './AppointmentCancelForm';
import { CalendarDays, Clock, CreditCard, FileText, Scissors, ShieldAlert, UserRound } from 'lucide-react';
import {
  getAppointmentOperations,
  PlatformAppointment,
} from '../actions/appointments';

const statusTabs = [
  { value: 'today', label: 'Today' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-shows' },
  { value: 'all', label: 'All' },
] as const;

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const statusClassNames: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-800',
  completed: 'border-slate-200 bg-slate-50 text-slate-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-800',
  no_show: 'border-zinc-300 bg-zinc-100 text-zinc-700',
};

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

function formatCurrency(value?: number | null) {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getServiceTotal(appointment: PlatformAppointment) {
  if (appointment.lineItems.length) {
    return appointment.lineItems.reduce((sum, item) => sum + (item.price || 0), 0) / 100;
  }

  return appointment.services.reduce((sum, service) => sum + (service.basePrice || 0), 0) / 100;
}

function hasComplianceNeeds(appointment: PlatformAppointment) {
  return appointment.services.some((service) => service.requiresPatchTest || service.requiresConsultation);
}

export async function AppointmentOperationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeStatus = resolvedSearchParams.status || 'today';
  const result = await getAppointmentOperations(activeStatus);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Salon operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Appointments</h1>
              <Link href="/book" className="mt-3 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background">New appointment</Link>

            </div>

          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-muted p-1 shadow-inner" aria-label="Appointment status filters">
          {statusTabs.map((tab) => {
            const isActive = activeStatus === tab.value;
            const href = tab.value === 'today' ? '/dashboard/platform/appointments' : `/dashboard/platform/appointments?status=${tab.value}`;
            const count = result.status === 'available'
              ? result.data.counts[tab.value as keyof typeof result.data.counts]
              : null;

            return (
              <Link
                key={tab.value}
                href={href}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {tab.label} {count !== null && <span className="ml-1 opacity-70">{count}</span>}
              </Link>
            );
          })}
        </nav>

        {result.status === 'unavailable' ? (
          <section role="alert" aria-labelledby="appointment-queue-error-title" className="rounded-2xl border border-amber-300 bg-amber-50 p-8 shadow-sm">
            <h2 id="appointment-queue-error-title" className="text-lg font-semibold">Appointment queue unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm text-amber-950">
              Appointments and counts could not be verified, so this view is not shown as empty or zero. Check your access or connection, then retry.
            </p>
            <RetryAppointmentQueueButton />
          </section>
        ) : result.data.appointments.length === 0 ? (
          <section className="rounded-2xl border bg-background p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">No appointments in this view</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              No appointments match this filter.
            </p>
          </section>
        ) : (
          <section className="grid gap-4">
            {result.data.appointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}


function AppointmentCard({ appointment }: { appointment: PlatformAppointment }) {
  const contact = appointmentContact(appointment);
  const clientName = contact.name;
  const clientEmail = contact.email || undefined;
  const stylistName = appointment.stylist?.user?.name || 'Unassigned';
  const serviceNames = appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'No services';
  const complianceNeeded = hasComplianceNeeds(appointment);
  const serviceTotal = getServiceTotal(appointment);

  return (
    <article className="rounded-2xl border bg-background p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClassNames[appointment.status] || 'bg-muted text-muted-foreground'}`}>
              {statusLabels[appointment.status] || appointment.status}
            </span>
            {appointment.depositAmount ? (
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${appointment.depositPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {appointment.depositPaid ? 'Deposit paid' : `Deposit due ${formatCurrency(appointment.depositAmount / 100)}`}
              </span>
            ) : null}
            {complianceNeeded ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-800">
                <ShieldAlert className="h-3.5 w-3.5" />
                Intake / consent required
              </span>
            ) : null}
          </div>

          <h2 className="text-xl font-semibold tracking-tight">{serviceNames}</h2>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
            <Info icon={Clock} label="When" value={formatSalonDateTime(appointment.startTime, appointment.location?.timezone)} />
            <Info icon={UserRound} label="Client" value={clientName} subvalue={clientEmail} />
            <Info icon={Scissors} label="Provider" value={stylistName} subvalue={appointment.stylist?.tier ? `${appointment.stylist.tier} tier` : undefined} />
            <Info icon={CreditCard} label="Checkout" value={formatCurrency(serviceTotal)} subvalue={appointment.payment?.status || 'No payment yet'} />
          </div>

          {(appointment.clientNotes || appointment.internalNotes) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {appointment.clientNotes && <NoteBlock title="Client notes" body={appointment.clientNotes} />}
              {appointment.internalNotes && <NoteBlock title="Internal notes" body={appointment.internalNotes} />}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-52">
          <AppointmentActions appointment={appointment} />
          <Link
            href={`/dashboard/platform/appointments/${appointment.id}`}
            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Open appointment
          </Link>
          <Link
            href={`/dashboard/platform/checkout/${appointment.id}`}
            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Checkout workflow
          </Link>
        </div>
      </div>
    </article>
  );
}

function AppointmentActions({ appointment }: { appointment: PlatformAppointment }) {
  if (appointment.status === 'cancelled' || appointment.status === 'completed' || appointment.status === 'no_show') {
    return null;
  }

  return (
    <div className="grid gap-2">
      {appointment.status === 'pending' && (
        <AppointmentStatusForm id={appointment.id} status="confirmed" label="Confirm" primary />
      )}
      {appointment.status === 'confirmed' && (
        <AppointmentStatusForm id={appointment.id} status="in_progress" label="Check in" primary />
      )}
      {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
        <AppointmentStatusForm id={appointment.id} status="no_show" label="Mark no-show" />
      )}
      <AppointmentCancelForm id={appointment.id} variant="queue" />
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  subvalue,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subvalue?: string;
}) {
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

function NoteBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-sm">
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        <FileText className="h-4 w-4" />
        {title}
      </div>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

export default AppointmentOperationsPage;
