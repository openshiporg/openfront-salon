'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { rescheduleOperatorAppointment, type RescheduleState } from '../actions/rescheduleAppointment';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';
import { TimeSlotPicker } from '@/features/storefront/components/TimeSlotPicker';
import { getAvailableTimeSlots, type BookingSlot } from '@/features/storefront/lib/data/availability';
import '@/features/storefront/styles/storefront.css';

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The appointment's start as a `datetime-local` value on the salon's wall clock. */
function wallClock(value: string, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(value));
    const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
}

type Slot = { stylistId?: string | null; locationId?: string | null; serviceId?: string | null; duration?: number | null };

/** Front-desk reschedule: an open slot for the same stylist by default, or a typed time as an override. */
export function AppointmentRescheduleForm({ id, startTime, timeZone, slot }: { id: string; startTime: string; timeZone?: string | null; slot: Slot }) {
  const zone = timeZone || 'UTC';
  const canPick = Boolean(slot.stylistId);
  const [mode, setMode] = useState<'slot' | 'manual'>(canPick ? 'slot' : 'manual');
  const [key, setKey] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [state, action, pending] = useActionState<RescheduleState, FormData>(rescheduleOperatorAppointment, { status: 'idle', message: '' });
  useEffect(() => { setKey(`operator-reschedule:${crypto.randomUUID()}`); }, []);
  useEffect(() => { if (state.status === 'success' || state.status === 'rejected') { setKey(`operator-reschedule:${crypto.randomUUID()}`); setTime(null); } }, [state]);

  useEffect(() => {
    let cancelled = false;
    setTime(null);
    setSlots([]);
    setFailed(false);
    if (!date || !slot.stylistId) return;
    setLoading(true);
    getAvailableTimeSlots(slot.stylistId, localDateKey(date), slot.duration || 60, slot.serviceId || undefined, slot.locationId || undefined)
      .then((result) => { if (!cancelled) setSlots(result); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, slot.stylistId, slot.duration, slot.serviceId, slot.locationId]);

  return (
    <form action={action} className="grid min-w-0 gap-4">
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="timeZone" value={zone} />
      {canPick ? (
        <div className={`${trackClass} justify-self-start`} role="group" aria-label="Reschedule mode">
          <button type="button" aria-pressed={mode === 'slot'} onClick={() => setMode('slot')} className={pillClass(mode === 'slot' ? 'raised' : 'quiet', 'sm')}>Open slots</button>
          <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')} className={pillClass(mode === 'manual' ? 'raised' : 'quiet', 'sm')}>Other time</button>
        </div>
      ) : null}
      {mode === 'slot' ? (
        <div className="storefront grid min-w-0 gap-3 !bg-transparent">
          <input type="hidden" name="startTime" value={time || ''} />
          <TimeSlotPicker selectedDate={date} onDateSelect={setDate} selectedTime={time} onTimeSelect={setTime} availableSlots={slots} loadingSlots={loading} />
          {failed ? <p role="alert" className="text-sm text-amber-800 dark:text-amber-300">Availability couldn&apos;t be checked. Try again.</p> : null}
        </div>
      ) : (
        <label className={fieldLabelClass}>New date and time<input name="startTime" type="datetime-local" step={900} defaultValue={wallClock(startTime, zone)} required className={`${inputClass} tabular-nums`} /><span className="font-normal">{zone.replaceAll('_', ' ')} · checked against the stylist&apos;s hours on save</span></label>
      )}
      <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={1000} className={inputClass} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          <button type="submit" disabled={pending || !key || (mode === 'slot' && !time)} className={pillClass('primary')}><CalendarClock />{pending ? 'Rescheduling…' : 'Save new time'}</button>
        </div>
        {state.status !== 'idle' ? <p role={state.status === 'success' ? 'status' : 'alert'} className={`text-sm ${state.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
