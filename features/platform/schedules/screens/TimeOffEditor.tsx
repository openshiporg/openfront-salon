'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarOff } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { fieldLabelClass, inputClass, pillClass, tableClass, tdClass, thClass } from '../../components/pill';
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
    <section aria-labelledby="time-off" className="min-w-0 overflow-hidden rounded-[6px] border bg-background">
      <div className="flex min-h-10 items-center gap-2 border-b bg-muted/30 px-4 py-1.5">
        <CalendarOff className="size-3.5 text-muted-foreground" />
        <h2 id="time-off" className="text-[13px] font-semibold">Time off</h2>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="grid gap-3 border-b p-4">
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
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Length</legend>
            <div className="inline-flex h-9 overflow-hidden rounded-[6px] border border-input">
              {[{ value: true, label: 'All day' }, { value: false, label: 'Set hours' }].map((option) => (
                <label key={option.label} className={`flex cursor-pointer items-center gap-2 px-3 text-sm transition-colors first:border-r has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring ${allDay === option.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}>
                  <input type="radio" name="timeOffLength" checked={allDay === option.value} onChange={() => setAllDay(option.value)} className="size-3.5 accent-foreground" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          {!allDay ? (
            <>
              <label className={fieldLabelClass}>Start<input name="start" type="time" required step={900} className={`${inputClass} h-9`} /></label>
              <label className={fieldLabelClass}>End<input name="end" type="time" required step={900} className={`${inputClass} h-9`} /></label>
            </>
          ) : null}
          <button type="submit" disabled={busy} className={pillClass('primary', 'md')}>{busy ? 'Saving…' : 'Add time off'}</button>
          {message ? <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>{message.text}</p> : null}
        </div>
      </form>
      {entries.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No upcoming time off</p> : (
        <div className="relative overflow-x-auto">
          <table className={tableClass} aria-label="Upcoming time off">
            <thead><tr><th scope="col" className={thClass}>Date</th><th scope="col" className={thClass}>Stylist</th><th scope="col" className={thClass}>Hours</th><th scope="col" className={`${thClass} hidden sm:table-cell`}>Reason</th><th scope="col" className={thClass}>Bookings</th><th scope="col" className={thClass}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={`${tdClass} whitespace-nowrap font-medium`}>{dayLabel(entry.localDate)}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{entry.stylistName}</td>
                  <td className={`${tdClass} whitespace-nowrap tabular-nums text-muted-foreground`}>{entry.startTime === '00:00' && entry.endTime === '23:59' ? 'All day' : `${hhmm(entry.startTime)}–${hhmm(entry.endTime)}`}</td>
                  <td className={`${tdClass} hidden text-muted-foreground sm:table-cell`}>{entry.reason || '—'}</td>
                  <td className={tdClass}>
                    {entry.clashes.length ? (
                      <ul className="grid gap-0.5 text-xs text-rose-700 dark:text-rose-400">
                        {entry.clashes.map((clash) => <li key={clash.id}><Link href={`/dashboard/platform/appointments/${clash.id}`} className="underline-offset-4 hover:underline">Booked {clashTime(clash.startTime, clash.timezone)} · {clash.clientName}</Link></li>)}
                      </ul>
                    ) : <span className="text-muted-foreground">None</span>}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <form action={async (formData) => { await withdrawTimeOff(formData); router.refresh(); }}>
                      <input type="hidden" name="stylistId" value={entry.stylistId} />
                      <input type="hidden" name="localDate" value={entry.localDate} />
                      <RemoveButton />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={pillClass('quiet', 'sm')}>{pending ? 'Removing…' : 'Remove'}</button>;
}
