import Link from 'next/link';
import { cn } from '@/lib/utils';
import { appointmentContact } from '../../lib/appointmentContact';
import { appointmentLabel, appointmentTone, type Tone } from '../../components/salon-ui';
import type { PlatformAppointment } from '../actions/appointments';

/*
 * The day board: one lane per stylist, each appointment a block placed by its
 * start and end on the salon's wall clock, and a now-line across every lane.
 * The board scrolls sideways inside its own frame on a phone; the stylist
 * column stays pinned.
 */

const blockTones: Record<Tone, string> = {
  amber: 'border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 hover:border-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
  blue: 'border-blue-300 bg-blue-50 text-blue-950 hover:border-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50',
  zinc: 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200',
  rose: 'border-rose-200 bg-rose-50/60 text-rose-900/70 hover:border-rose-400 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200/70',
  orange: 'border-orange-200 bg-orange-50/60 text-orange-900/70 hover:border-orange-400 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200/70',
  violet: 'border-violet-300 bg-violet-50 text-violet-950 hover:border-violet-500 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50',
  sky: 'border-sky-300 bg-sky-50 text-sky-950 hover:border-sky-500 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-50',
};

const ROW = 44;

/** Minutes since midnight on the salon's wall clock. */
function wallMinutes(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(value));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return get('hour') * 60 + get('minute');
}

function dayKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function hourLabel(hour: number) {
  const h = hour % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
}

export function appointmentEnd(appointment: PlatformAppointment) {
  if (appointment.endTime) return appointment.endTime;
  const minutes = appointment.duration || appointment.services.reduce((sum, service) => sum + (service.baseDuration || 0), 0) || 60;
  return new Date(new Date(appointment.startTime).getTime() + minutes * 60000).toISOString();
}

type Placed = { appointment: PlatformAppointment; start: number; end: number; row: number };

export function DayBoard({ appointments, timeZone, now = new Date() }: { appointments: PlatformAppointment[]; timeZone: string; now?: Date }) {
  const items = appointments.map((appointment) => {
    const start = wallMinutes(appointment.startTime, timeZone);
    let end = wallMinutes(appointmentEnd(appointment), timeZone);
    if (end <= start) end = Math.min(24 * 60, start + (appointment.duration || 60));
    return { appointment, start, end };
  });

  const firstHour = items.length ? Math.floor(Math.min(...items.map((item) => item.start)) / 60) : 9;
  const lastHour = items.length ? Math.ceil(Math.max(...items.map((item) => item.end)) / 60) : 18;
  // The booked span padded to whole hours, never narrower than a 9–6 day so a single visit still reads in context.
  const spanStart = Math.min(firstHour, 9) * 60;
  const spanEnd = Math.min(24, Math.max(lastHour, 18)) * 60;
  const total = Math.max(60, spanEnd - spanStart);
  const pct = (minutes: number) => `${((minutes - spanStart) / total) * 100}%`;
  const hours = Array.from({ length: total / 60 + 1 }, (_, index) => spanStart / 60 + index);

  const laneMap = new Map<string, { id: string; name: string; placed: Placed[]; rows: number }>();
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const id = item.appointment.stylist?.id || 'unassigned';
    const lane = laneMap.get(id) || { id, name: item.appointment.stylist?.user?.name || 'Unassigned', placed: [], rows: 0 };
    const ends: number[] = [];
    for (const placed of lane.placed) ends[placed.row] = Math.max(ends[placed.row] ?? 0, placed.end);
    let row = ends.findIndex((end) => end <= item.start);
    if (row === -1) row = ends.length;
    lane.placed.push({ ...item, row });
    lane.rows = Math.max(lane.rows, row + 1);
    laneMap.set(id, lane);
  }
  const lanes = [...laneMap.values()].sort((a, b) => (a.id === 'unassigned' ? 1 : b.id === 'unassigned' ? -1 : a.name.localeCompare(b.name)));

  const sameDay = items.length > 0 && dayKey(now, timeZone) === dayKey(appointments[0].startTime, timeZone);
  const nowMinutes = wallMinutes(now, timeZone);
  const showNow = sameDay && nowMinutes >= spanStart && nowMinutes <= spanEnd;

  return (
    <section aria-label="Day board" className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div className="relative min-w-[46rem]">
          <div className="flex h-8 border-b bg-muted/40">
            <div className="sticky left-0 z-20 flex w-32 shrink-0 items-center border-r bg-muted px-3 text-xs font-medium text-muted-foreground md:w-40">Stylist</div>
            <div className="relative flex-1" aria-hidden="true">
              {hours.map((hour) => (
                <span key={hour} className="absolute top-0 flex h-full -translate-x-1/2 items-center text-[11px] tabular-nums text-muted-foreground first:translate-x-0 last:-translate-x-full" style={{ left: pct(hour * 60) }}>
                  <span className="px-1">{hourLabel(hour)}</span>
                </span>
              ))}
            </div>
          </div>

          {lanes.map((lane) => (
            <div key={lane.id} className="flex border-b last:border-b-0">
              <div className="sticky left-0 z-20 flex w-32 shrink-0 items-center border-r bg-background px-3 text-sm font-medium md:w-40">
                <span className="truncate">{lane.name}</span>
                <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{lane.placed.length}</span>
              </div>
              <div className="relative flex-1" style={{ height: lane.rows * ROW + 8 }}>
                {hours.map((hour) => <span key={hour} aria-hidden="true" className="absolute inset-y-0 w-px bg-border/60" style={{ left: pct(hour * 60) }} />)}
                {lane.placed.map(({ appointment, start, end, row }) => {
                  const contact = appointmentContact(appointment);
                  const tone = appointmentTone[appointment.status] || 'zinc';
                  const closed = appointment.status === 'cancelled' || appointment.status === 'no_show';
                  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.startTime));
                  const services = appointment.services.map((service) => service.name).filter(Boolean).join(', ');
                  return (
                    <Link
                      key={appointment.id}
                      href={`/dashboard/platform/appointments/${appointment.id}`}
                      title={`${time} · ${contact.name} · ${services || 'Appointment'} · ${appointmentLabel[appointment.status] || appointment.status}`}
                      className={cn(
                        'absolute flex min-w-0 flex-col justify-center overflow-hidden rounded-[4px] border px-1.5 text-left leading-tight transition-[border-color,transform] duration-150 ease-out active:scale-[0.99] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        blockTones[tone],
                        closed && 'line-through decoration-1',
                      )}
                      style={{ left: `calc(${pct(start)} + 1px)`, width: `calc(${((end - start) / total) * 100}% - 2px)`, top: row * ROW + 4, height: ROW - 4 }}
                    >
                      <span className="truncate text-xs font-semibold">{contact.name}</span>
                      <span className="truncate text-[11px] tabular-nums opacity-75">{time}{services ? ` · ${services}` : ''}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {showNow ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-32 right-0 md:left-40">
              <div className="absolute inset-y-0 w-px bg-rose-500" style={{ left: pct(nowMinutes) }}>
                <span className="absolute top-1.5 -translate-x-1/2 rounded-[4px] bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">Now</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
