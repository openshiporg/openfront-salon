import Link from 'next/link';
import { ArrowUpRight, CalendarClock, UsersRound } from 'lucide-react';
import { getScheduleOperations, PlatformSchedule, PlatformStylistSchedule, setScheduleAvailability } from '../actions/schedules';
import { labelize } from '../../components/pill';
import { WeeklyHoursEditor } from './WeeklyHoursEditor';
import { TimeOffEditor } from './TimeOffEditor';
import { appointmentContact } from '../../lib/appointmentContact';
import { Avatar, EmptyState, inputClass, MetricStrip, Notice, PageHeader, pillClass, PillLink, PlatformPage, StatusDot, TitleStatus, Track, trackClass } from '../../components/salon-ui';

// The salon week starts on Monday; dayOfWeek keeps JavaScript's 0 = Sunday.
const week = [
  { index: 1, label: 'Mon' }, { index: 2, label: 'Tue' }, { index: 3, label: 'Wed' }, { index: 4, label: 'Thu' },
  { index: 5, label: 'Fri' }, { index: 6, label: 'Sat' }, { index: 0, label: 'Sun' },
];

function hhmm(value?: string | null) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours)) return value;
  const suffix = hours >= 12 ? 'p' : 'a';
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${suffix}`;
}

function formatAppointmentTime(value?: string | null, timeZone?: string | null) {
  if (!value) return 'Unscheduled';
  return new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined });
}

/** "Master stylist", "Senior nail tech": tier first, then role. */
function roleLabel(role?: string | null, tier?: string | null) {
  const roleText = labelize(role || 'stylist').toLowerCase();
  return tier ? `${labelize(tier)} ${roleText}` : labelize(roleText);
}

export async function StaffSchedulePage() {
  const { stylists, timeOff, scheduleCount, inactiveScheduleCount, activeProviderCount } = await getScheduleOperations();
  const clashes = timeOff.reduce((sum, entry) => sum + entry.clashes.length, 0);
  const providersWithoutSchedules = stylists.filter((stylist) => stylist.schedules.length === 0).length;

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Staff schedules' }]}>
      <PageHeader
        icon={CalendarClock}
        title="Staff schedules"
        status={<TitleStatus tone={providersWithoutSchedules > 0 ? 'amber' : 'emerald'}>{providersWithoutSchedules > 0 ? `${providersWithoutSchedules} without hours` : 'Everyone scheduled'}</TitleStatus>}
        actions={<Track><PillLink href="/dashboard/platform/administration#management-staff">Edit staff<ArrowUpRight /></PillLink></Track>}
      />

      <MetricStrip
        items={[
          { label: 'Active stylists', value: activeProviderCount },
          { label: 'Weekly blocks', value: scheduleCount, tone: 'emerald' },
          { label: 'Blocked weekly', value: inactiveScheduleCount, tone: inactiveScheduleCount > 0 ? 'rose' : undefined },
          { label: 'Time-off clashes', value: clashes, tone: clashes > 0 ? 'rose' : undefined },
        ]}
      />

      {providersWithoutSchedules > 0 ? (
        <Notice title={`${providersWithoutSchedules} active stylist${providersWithoutSchedules === 1 ? '' : 's'} without weekly hours`}>No online booking slots until hours are added.</Notice>
      ) : null}

      {stylists.length === 0 ? (
        <EmptyState icon={UsersRound} title="No active stylists" action={<Track><PillLink href="/dashboard/platform/administration#management-staff">Add staff</PillLink></Track>} />
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl border bg-background">
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-background to-transparent lg:hidden" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="sticky left-0 z-10 w-56 bg-background px-4 py-2.5 font-medium">Stylist</th>
                    {week.map((day) => <th key={day.index} scope="col" className="px-2 py-2.5 font-medium">{day.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stylists.map((stylist) => <RosterRow key={stylist.id} stylist={stylist} />)}
                </tbody>
              </table>
            </div>
          </div>

          <WeeklyHoursEditor stylists={stylists} />
          <TimeOffEditor stylists={stylists} entries={timeOff} />

          <section aria-label="Next appointments by stylist" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stylists.filter((stylist) => stylist.appointments.length > 0).map((stylist) => (
              <div key={stylist.id} className="rounded-2xl border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Avatar name={stylist.user?.name} className="size-7 text-[10px]" />{stylist.user?.name || 'Unnamed stylist'}<span className="font-normal text-muted-foreground">· {stylist.appointments.length} upcoming</span></div>
                <ul className="mt-3 grid gap-2">
                  {stylist.appointments.slice(0, 4).map((appointment) => (
                    <li key={appointment.id} className="text-sm">
                      <Link href={`/dashboard/platform/appointments/${appointment.id}`} className="font-medium tabular-nums hover:underline">{formatAppointmentTime(appointment.startTime, appointment.location?.timezone)}</Link>
                      <span className="block truncate text-xs text-muted-foreground">{appointment.client?.displayName || appointmentContact({ metadata: appointment.metadata }).name} · {appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'Service'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </PlatformPage>
  );
}

function RosterRow({ stylist }: { stylist: PlatformStylistSchedule }) {
  const name = stylist.user?.name || 'Unnamed stylist';
  const byDay = new Map<number, PlatformSchedule[]>();
  stylist.schedules.forEach((schedule) => {
    const day = schedule.dayOfWeek ?? -1;
    byDay.set(day, [...(byDay.get(day) || []), schedule]);
  });
  const specialties = stylist.specializations.map((service) => service.name).filter(Boolean);

  return (
    <tr className="align-top">
      <th scope="row" className="sticky left-0 z-10 bg-background px-4 py-3 text-left font-normal">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} className="size-8 text-[11px]" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{roleLabel(stylist.role, stylist.tier)}</div>
          </div>
        </div>
        {specialties.length ? <div className="mt-2 line-clamp-2 max-w-[12rem] text-xs text-muted-foreground">{specialties.join(', ')}</div> : null}
      </th>
      {week.map((day) => {
        const blocks = byDay.get(day.index) || [];
        return (
          <td key={day.index} className="px-1.5 py-2">
            {blocks.length ? <div className="grid gap-1.5">{blocks.map((schedule) => <ShiftBlock key={schedule.id} schedule={schedule} />)}</div> : <span className="block px-1.5 py-1 text-xs text-muted-foreground/70">Off</span>}
          </td>
        );
      })}
    </tr>
  );
}

function ShiftBlock({ schedule }: { schedule: PlatformSchedule }) {
  const blocked = schedule.isAvailable === false;
  const hours = schedule.startTime && schedule.endTime ? `${hhmm(schedule.startTime)}–${hhmm(schedule.endTime)}` : 'No hours';

  return (
    <div className={`rounded-lg border px-2 py-1.5 text-xs ${blocked ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30' : 'bg-muted/30'}`}>
      <div className="flex items-center gap-1.5 font-medium tabular-nums"><StatusDot tone={blocked ? 'rose' : 'emerald'} className="size-1.5" />{hours}</div>
      {schedule.breakStart && schedule.breakEnd ? <div className="mt-0.5 text-muted-foreground">Break {hhmm(schedule.breakStart)}–{hhmm(schedule.breakEnd)}</div> : null}
      {schedule.reason ? <div className="mt-0.5 truncate text-muted-foreground" title={schedule.reason}>{schedule.reason}</div> : null}
      {blocked ? (
        <form action={setScheduleAvailability} className={`${trackClass} mt-1.5`}>
          <input type="hidden" name="id" value={schedule.id} />
          <input type="hidden" name="revision" value={schedule.revision} />
          <input type="hidden" name="isAvailable" value="true" />
          <button type="submit" className={pillClass('raised', 'sm')}>Restore</button>
        </form>
      ) : (
        <details className="group mt-1.5">
          <summary className={`${trackClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><span className={pillClass('quiet', 'sm')}>Block weekly</span></summary>
          <form action={setScheduleAvailability} className="mt-1.5 grid gap-1.5">
            <input type="hidden" name="id" value={schedule.id} />
            <input type="hidden" name="revision" value={schedule.revision} />
            <input type="hidden" name="isAvailable" value="false" />
            <input name="reason" placeholder="Reason" aria-label="Block reason" className={`${inputClass} h-8 rounded-lg px-2 text-xs`} />
            <div className={trackClass}><button type="submit" className={pillClass('danger', 'sm')}>Block every week</button></div>
          </form>
        </details>
      )}
    </div>
  );
}

export default StaffSchedulePage;
