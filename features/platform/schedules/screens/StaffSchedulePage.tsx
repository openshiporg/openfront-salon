import Link from 'next/link';
import { ArrowUpRight, CalendarDays, UsersRound } from 'lucide-react';
import { getScheduleOperations, PlatformSchedule, PlatformStylistSchedule, setScheduleAvailability } from '../actions/schedules';
import { labelize } from '../../components/pill';
import { WeeklyHoursEditor } from './WeeklyHoursEditor';
import { TimeOffEditor } from './TimeOffEditor';
import { BlockDayMenu } from './BlockDayMenu';
import { appointmentContact } from '../../lib/appointmentContact';
import { getSalonTimezone } from '../../lib/salonTimezone';
import { Avatar, DataTable, EmptyState, Notice, PageHeader, Panel, pillClass, PillLink, PlatformPage, StatusCell, Td, TitleStatus, Track } from '../../components/salon-ui';

// The salon week starts on Monday; dayOfWeek keeps JavaScript's 0 = Sunday.
const week = [
  { index: 1, label: 'Mon' }, { index: 2, label: 'Tue' }, { index: 3, label: 'Wed' }, { index: 4, label: 'Thu' },
  { index: 5, label: 'Fri' }, { index: 6, label: 'Sat' }, { index: 0, label: 'Sun' },
];
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

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

/** Today's weekday and calendar date in the salon's timezone. */
function salonToday(timeZone?: string) {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(now);
  const localDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(now);
  return { day: weekdayIndex[weekday] ?? now.getDay(), localDate };
}

export async function StaffSchedulePage() {
  const [{ stylists, timeOff }, timeZone] = await Promise.all([getScheduleOperations(), getSalonTimezone()]);
  const today = salonToday(timeZone);
  const clashes = timeOff.reduce((sum, entry) => sum + entry.clashes.length, 0);
  const providersWithoutSchedules = stylists.filter((stylist) => stylist.schedules.length === 0).length;
  const offToday = new Map(timeOff.filter((entry) => entry.localDate === today.localDate).map((entry) => [entry.stylistId, entry]));
  const workingToday = stylists.flatMap((stylist) => {
    const shift = stylist.schedules.find((schedule) => schedule.dayOfWeek === today.day && schedule.isAvailable !== false);
    return shift ? [{ stylist, shift, off: offToday.get(stylist.id) }] : [];
  });
  const nextAppointments = stylists
    .flatMap((stylist) => stylist.appointments.slice(0, 4).map((appointment) => ({ stylist, appointment })))
    .sort((a, b) => String(a.appointment.startTime || '').localeCompare(String(b.appointment.startTime || '')));

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Staff schedules' }]}>
      <PageHeader
        title="Staff schedules"
        status={providersWithoutSchedules > 0 ? <TitleStatus tone="amber">{providersWithoutSchedules} without hours</TitleStatus> : null}
        meta={stylists.length ? <span>{stylists.length} active stylist{stylists.length === 1 ? '' : 's'}{clashes ? ` · ${clashes} booking${clashes === 1 ? '' : 's'} during time off` : ''}</span> : null}
        actions={<Track><PillLink href="/dashboard/platform/administration#management-staff">Edit staff<ArrowUpRight /></PillLink></Track>}
      />

      {providersWithoutSchedules > 0 ? (
        <Notice title={`${providersWithoutSchedules} active stylist${providersWithoutSchedules === 1 ? '' : 's'} without weekly hours`}>No online booking slots until hours are added.</Notice>
      ) : null}

      {stylists.length === 0 ? (
        <EmptyState icon={UsersRound} title="No active stylists" action={<Track><PillLink href="/dashboard/platform/administration#management-staff">Add staff</PillLink></Track>} />
      ) : (
        <>
          <Panel title={`Working today · ${week.find((day) => day.index === today.day)?.label || ''}`} padded={false}>
            {workingToday.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No one is scheduled today.</p> : (
              <ul className="divide-y sm:flex sm:flex-wrap sm:divide-x sm:divide-y-0">
                {workingToday.map(({ stylist, shift, off }) => (
                  <li key={stylist.id} className="flex min-w-0 items-center gap-2.5 px-4 py-2.5 sm:min-w-[14rem]">
                    <Avatar name={stylist.user?.name} className="size-7 text-[10px]" />
                    <div className="min-w-0 text-sm">
                      <Link href={`/dashboard/platform/staff/${stylist.id}`} className="block truncate font-medium underline-offset-4 hover:underline">{stylist.user?.name || 'Unnamed stylist'}</Link>
                      {off ? <StatusCell tone="rose">Off {off.startTime === '00:00' && off.endTime === '23:59' ? 'all day' : `${hhmm(off.startTime)}–${hhmm(off.endTime)}`}</StatusCell> : <span className="block tabular-nums text-xs text-muted-foreground">{hhmm(shift.startTime)}–{hhmm(shift.endTime)}{shift.breakStart && shift.breakEnd ? ` · break ${hhmm(shift.breakStart)}` : ''}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section aria-labelledby="week-grid" className="grid gap-2">
            <h2 id="week-grid" className="text-sm font-semibold">This week</h2>
            <div className="min-w-0 overflow-x-auto rounded-[6px] border bg-background">
              <table className="w-full min-w-[52rem] border-collapse text-sm" aria-label="Weekly hours by stylist">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="sticky left-0 z-10 h-9 w-52 border-b bg-muted/40 px-3 font-medium">Stylist</th>
                    {week.map((day) => (
                      <th key={day.index} scope="col" aria-current={day.index === today.day ? 'date' : undefined} className={`h-9 border-b px-3 font-medium ${day.index === today.day ? 'bg-muted text-foreground' : 'bg-muted/40'}`}>{day.label}{day.index === today.day ? <span className="ml-1.5 font-normal text-muted-foreground">today</span> : null}</th>
                    ))}
                    <th scope="col" className="h-9 border-b bg-muted/40 px-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {stylists.map((stylist) => <RosterRow key={stylist.id} stylist={stylist} today={today.day} />)}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5">
            <WeeklyHoursEditor stylists={stylists} />
            <TimeOffEditor stylists={stylists} entries={timeOff} />
          </div>

          {nextAppointments.length ? (
            <section aria-labelledby="next-appointments" className="grid gap-2">
              <h2 id="next-appointments" className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-3.5 text-muted-foreground" />Next appointments</h2>
              <DataTable label="Next appointments by stylist" head={[{ label: 'When' }, { label: 'Stylist' }, { label: 'Client' }, { label: 'Services', className: 'hidden md:table-cell' }]}>
                {nextAppointments.map(({ stylist, appointment }) => (
                  <tr key={appointment.id} className="hover:bg-muted/30">
                    <Td className="whitespace-nowrap"><Link href={`/dashboard/platform/appointments/${appointment.id}`} className="font-medium tabular-nums underline-offset-4 hover:underline">{formatAppointmentTime(appointment.startTime, appointment.location?.timezone || timeZone)}</Link></Td>
                    <Td className="whitespace-nowrap">{stylist.user?.name || 'Unnamed stylist'}</Td>
                    <Td>{appointment.client?.displayName || appointmentContact({ metadata: appointment.metadata }).name}<span className="block text-xs text-muted-foreground md:hidden">{appointment.services.map((service) => service.name).filter(Boolean).join(', ')}</span></Td>
                    <Td className="hidden text-muted-foreground md:table-cell">{appointment.services.map((service) => service.name).filter(Boolean).join(', ') || 'Service'}</Td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}
        </>
      )}
    </PlatformPage>
  );
}

function RosterRow({ stylist, today }: { stylist: PlatformStylistSchedule; today: number }) {
  const name = stylist.user?.name || 'Unnamed stylist';
  const byDay = new Map<number, PlatformSchedule[]>();
  stylist.schedules.forEach((schedule) => {
    const day = schedule.dayOfWeek ?? -1;
    byDay.set(day, [...(byDay.get(day) || []), schedule]);
  });
  const blockable = week.flatMap((day) => (byDay.get(day.index) || []).filter((schedule) => schedule.isAvailable !== false).map((schedule) => ({
    id: schedule.id, revision: schedule.revision, label: `${day.label} ${hhmm(schedule.startTime)}–${hhmm(schedule.endTime)}`,
  })));

  return (
    <tr className="align-top hover:bg-muted/20">
      <th scope="row" className="sticky left-0 z-10 border-b bg-background px-3 py-2.5 text-left font-normal [tr:last-child>&]:border-b-0">
        <div className="flex items-center gap-2.5">
          <Avatar name={name} className="size-7 text-[10px]" />
          <div className="min-w-0">
            <Link href={`/dashboard/platform/staff/${stylist.id}`} className="block truncate font-medium underline-offset-4 hover:underline">{name}</Link>
            <div className="truncate text-xs text-muted-foreground">{roleLabel(stylist.role, stylist.tier)}</div>
          </div>
        </div>
      </th>
      {week.map((day) => {
        const blocks = byDay.get(day.index) || [];
        return (
          <td key={day.index} className={`border-b px-3 py-2.5 text-xs [tr:last-child>&]:border-b-0 ${day.index === today ? 'bg-muted/40' : ''}`}>
            {blocks.length ? <div className="grid gap-1.5">{blocks.map((schedule) => <ShiftCell key={schedule.id} schedule={schedule} />)}</div> : <span className="text-muted-foreground/70">Off</span>}
          </td>
        );
      })}
      <td className="border-b px-3 py-2 text-right [tr:last-child>&]:border-b-0">
        {blockable.length ? <BlockDayMenu stylistName={name} shifts={blockable} action={setScheduleAvailability} /> : null}
      </td>
    </tr>
  );
}

function ShiftCell({ schedule }: { schedule: PlatformSchedule }) {
  const blocked = schedule.isAvailable === false;
  const hours = schedule.startTime && schedule.endTime ? `${hhmm(schedule.startTime)}–${hhmm(schedule.endTime)}` : 'No hours';
  if (blocked) {
    return (
      <div className="grid gap-1">
        <StatusCell tone="rose">Blocked</StatusCell>
        {schedule.reason ? <span className="truncate text-muted-foreground" title={schedule.reason}>{schedule.reason}</span> : null}
        <form action={setScheduleAvailability}>
          <input type="hidden" name="id" value={schedule.id} />
          <input type="hidden" name="revision" value={schedule.revision} />
          <input type="hidden" name="isAvailable" value="true" />
          <button type="submit" className={pillClass('raised', 'sm')}>Restore</button>
        </form>
      </div>
    );
  }
  return (
    <div>
      <div className="whitespace-nowrap font-medium tabular-nums text-foreground">{hours}</div>
      {schedule.breakStart && schedule.breakEnd ? <div className="whitespace-nowrap text-muted-foreground">Break {hhmm(schedule.breakStart)}–{hhmm(schedule.breakEnd)}</div> : null}
    </div>
  );
}

export default StaffSchedulePage;
