'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';
import { saveWeeklyHours, type PlatformStylistSchedule } from '../actions/schedules';

const week = [
  { index: 1, label: 'Monday' }, { index: 2, label: 'Tuesday' }, { index: 3, label: 'Wednesday' }, { index: 4, label: 'Thursday' },
  { index: 5, label: 'Friday' }, { index: 6, label: 'Saturday' }, { index: 0, label: 'Sunday' },
];

export function WeeklyHoursEditor({ stylists }: { stylists: PlatformStylistSchedule[] }) {
  const router = useRouter();
  const [stylistId, setStylistId] = useState(stylists[0]?.id || '');
  const stylist = stylists.find((item) => item.id === stylistId);
  const [locationId, setLocationId] = useState(stylist?.locations[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof stylist>['schedules'][number]>();
    stylist?.schedules
      .filter((schedule) => (schedule.type || 'recurring') === 'recurring' && schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined && (!schedule.location?.id || schedule.location.id === locationId))
      .forEach((schedule) => { if (!map.has(schedule.dayOfWeek!)) map.set(schedule.dayOfWeek!, schedule); });
    return map;
  }, [stylist, locationId]);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveWeeklyHours(new FormData(form));
      setMessage(result.success ? { ok: true, text: 'Hours saved.' } : { ok: false, text: result.error || 'Hours could not be saved.' });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Hours could not be saved. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!stylists.length) return null;

  return (
    <section aria-labelledby="weekly-hours" className="min-w-0 overflow-hidden rounded-2xl border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3 md:px-5">
        <h2 id="weekly-hours" className="text-sm font-semibold">Weekly hours</h2>
        <div className="flex flex-wrap gap-3">
          <label className={fieldLabelClass}>Stylist
            <select className={`${inputClass} h-9`} value={stylistId} onChange={(event) => { const next = stylists.find((item) => item.id === event.target.value); setStylistId(event.target.value); setLocationId(next?.locations[0]?.id || ''); setMessage(null); }}>
              {stylists.map((item) => <option key={item.id} value={item.id}>{item.user?.name || 'Unnamed stylist'}</option>)}
            </select>
          </label>
          {stylist && stylist.locations.length > 1 ? (
            <label className={fieldLabelClass}>Location
              <select className={`${inputClass} h-9`} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                {stylist.locations.map((location) => <option key={location.id} value={location.id}>{location.name || 'Location'}</option>)}
              </select>
            </label>
          ) : null}
        </div>
      </div>
      {!stylist?.locations.length ? (
        <p className="px-4 py-6 text-sm text-muted-foreground md:px-5">Assign a location to this stylist before adding hours.</p>
      ) : (
        <form key={`${stylistId}:${locationId}:${stylist.schedules.map((schedule) => `${schedule.id}@${schedule.revision}`).join(',')}`} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid gap-4 p-4 md:p-5">
          <input type="hidden" name="stylistId" value={stylistId} />
          <input type="hidden" name="locationId" value={locationId} />
          <div className="grid gap-2">
            <div className="hidden grid-cols-[8rem_repeat(4,minmax(0,1fr))] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
              <span>Day</span><span>Start</span><span>End</span><span>Break start</span><span>Break end</span>
            </div>
            {week.map((day) => <DayRow key={day.index} day={day} schedule={byDay.get(day.index)} />)}
          </div>
          {message ? <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{message.text}</p> : null}
          <div className={`${trackClass} justify-self-start`}>
            <button type="submit" disabled={busy} className={pillClass('primary')}><Save />{busy ? 'Saving…' : 'Save hours'}</button>
          </div>
        </form>
      )}
    </section>
  );
}

function DayRow({ day, schedule }: { day: { index: number; label: string }; schedule?: PlatformStylistSchedule['schedules'][number] }) {
  const [working, setWorking] = useState(Boolean(schedule && schedule.isAvailable !== false));
  const name = (field: string) => `day.${day.index}.${field}`;
  const time = 'h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm tabular-nums disabled:opacity-40';
  return (
    <div className="grid grid-cols-2 items-center gap-2 rounded-xl border p-2 md:grid-cols-[8rem_repeat(4,minmax(0,1fr))] md:border-0 md:p-1">
      <label className="col-span-2 flex items-center gap-2 text-sm font-medium md:col-span-1">
        <input type="checkbox" checked={working} onChange={(event) => setWorking(event.target.checked)} className="size-4 accent-foreground" />
        {day.label}
      </label>
      <input type="hidden" name={name('working')} value={String(working)} />
      <input type="hidden" name={name('scheduleId')} value={schedule?.id || ''} />
      <input type="hidden" name={name('revision')} value={schedule?.revision ?? ''} />
      <input type="hidden" name={name('previousStart')} value={schedule?.startTime || ''} />
      <input type="hidden" name={name('previousEnd')} value={schedule?.endTime || ''} />
      <input type="hidden" name={name('previousBreakStart')} value={schedule?.breakStart || ''} />
      <input type="hidden" name={name('previousBreakEnd')} value={schedule?.breakEnd || ''} />
      <label className="grid min-w-0 gap-1 text-[11px] font-medium text-muted-foreground"><span className="md:sr-only">Start</span><input aria-label={`${day.label} start`} type="time" step={900} name={name('start')} defaultValue={schedule?.startTime || '09:00'} disabled={!working} required={working} className={time} /></label>
      <label className="grid min-w-0 gap-1 text-[11px] font-medium text-muted-foreground"><span className="md:sr-only">End</span><input aria-label={`${day.label} end`} type="time" step={900} name={name('end')} defaultValue={schedule?.endTime || '17:00'} disabled={!working} required={working} className={time} /></label>
      <label className="grid min-w-0 gap-1 text-[11px] font-medium text-muted-foreground"><span className="md:sr-only">Break start</span><input aria-label={`${day.label} break start`} type="time" step={900} name={name('breakStart')} defaultValue={schedule?.breakStart || ''} disabled={!working} className={time} /></label>
      <label className="grid min-w-0 gap-1 text-[11px] font-medium text-muted-foreground"><span className="md:sr-only">Break end</span><input aria-label={`${day.label} break end`} type="time" step={900} name={name('breakEnd')} defaultValue={schedule?.breakEnd || ''} disabled={!working} className={time} /></label>
    </div>
  );
}
