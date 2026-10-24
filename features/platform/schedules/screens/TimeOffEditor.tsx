'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarOff } from 'lucide-react';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';
import { addTimeOff, withdrawTimeOff, type PlatformStylistSchedule, type TimeOffEntry } from '../actions/schedules';

function hhmm(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}${hours >= 12 ? 'p' : 'a'}`;
}

function dayLabel(localDate: string) {
  return new Date(`${localDate}T12:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function clashTime(value: string, timeZone?: string | null) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || undefined });
}

/** One-off time off (sick day, vacation): blocks dates without touching the weekly hours. */
export function TimeOffEditor({ stylists, entries }: { stylists: PlatformStylistSchedule[]; entries: TimeOffEntry[] }) {
  const router = useRouter();
  const [stylistId, setStylistId] = useState(stylists[0]?.id || '');
  const [from, setFrom] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await addTimeOff(new FormData(form));
      setMessage(result.success ? { ok: true, text: 'Time off saved.' } : { ok: false, text: result.error || 'Time off could not be saved.' });
      if (result.success) form.reset();
      router.refresh();
    } catch {
      setMessage({ ok: false, text: 'Time off could not be saved. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!stylists.length) return null;

  return (
    <section aria-labelledby="time-off" className="min-w-0 overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3 md:px-5">
        <CalendarOff className="size-4 text-muted-foreground" />
        <h2 id="time-off" className="text-sm font-semibold">Time off</h2>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid gap-3 border-b p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={fieldLabelClass}>Stylist
            <select name="stylistId" className={inputClass} value={stylistId} onChange={(event) => setStylistId(event.target.value)}>
              {stylists.map((item) => <option key={item.id} value={item.id}>{item.user?.name || 'Unnamed stylist'}</option>)}
            </select>
          </label>
          <label className={fieldLabelClass}>From<input name="from" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} className={inputClass} /></label>
          <label className={fieldLabelClass}>To<input name="to" type="date" min={from || undefined} className={inputClass} /></label>
          <label className={fieldLabelClass}>Reason<input name="reason" maxLength={200} placeholder="Vacation" className={inputClass} /></label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="allDay" value={allDay ? 'true' : 'false'} />
          <div className={trackClass} role="group" aria-label="Time off length">
            <button type="button" aria-pressed={allDay} onClick={() => setAllDay(true)} className={pillClass(allDay ? 'raised' : 'quiet', 'sm')}>All day</button>
            <button type="button" aria-pressed={!allDay} onClick={() => setAllDay(false)} className={pillClass(!allDay ? 'raised' : 'quiet', 'sm')}>Set hours</button>
          </div>
          {!allDay ? (
            <>
              <label className={fieldLabelClass}>Start<input name="start" type="time" required step={900} className={`${inputClass} h-9`} /></label>
              <label className={fieldLabelClass}>End<input name="end" type="time" required step={900} className={`${inputClass} h-9`} /></label>
            </>
          ) : null}
          <div className={trackClass}><button type="submit" disabled={busy} className={pillClass('primary')}>{busy ? 'Saving…' : 'Add time off'}</button></div>
          {message ? <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>{message.text}</p> : null}
        </div>
      </form>
      {entries.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground md:px-5">No upcoming time off</p> : (
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 md:px-5">
              <div className="min-w-0">
                <div className="text-sm font-medium">{entry.stylistName} · {dayLabel(entry.localDate)}</div>
                <div className="text-xs text-muted-foreground">{entry.startTime === '00:00' && entry.endTime === '23:59' ? 'All day' : `${hhmm(entry.startTime)}–${hhmm(entry.endTime)}`}{entry.reason ? ` · ${entry.reason}` : ''}</div>
                {entry.clashes.length ? (
                  <ul className="mt-1.5 grid gap-0.5 text-xs text-rose-700 dark:text-rose-400">
                    {entry.clashes.map((clash) => <li key={clash.id}><Link href={`/dashboard/platform/appointments/${clash.id}`} className="underline-offset-4 hover:underline">Booked {clashTime(clash.startTime, clash.timezone)} · {clash.clientName}</Link></li>)}
                  </ul>
                ) : null}
              </div>
              <form action={async (formData) => { await withdrawTimeOff(formData); router.refresh(); }} className={trackClass}>
                <input type="hidden" name="stylistId" value={entry.stylistId} />
                <input type="hidden" name="localDate" value={entry.localDate} />
                <button type="submit" className={pillClass('quiet', 'sm')}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
