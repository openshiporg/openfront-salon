'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { rescheduleOperatorAppointment, type RescheduleState } from '../actions/rescheduleAppointment';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';

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

export function AppointmentRescheduleForm({ id, startTime, timeZone }: { id: string; startTime: string; timeZone?: string | null }) {
  const zone = timeZone || 'UTC';
  const [key, setKey] = useState('');
  const [state, action, pending] = useActionState<RescheduleState, FormData>(rescheduleOperatorAppointment, { status: 'idle', message: '' });
  useEffect(() => { setKey(`operator-reschedule:${crypto.randomUUID()}`); }, []);
  useEffect(() => { if (state.status === 'success') setKey(`operator-reschedule:${crypto.randomUUID()}`); }, [state]);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="timeZone" value={zone} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldLabelClass}>New date and time<input name="startTime" type="datetime-local" step={900} defaultValue={wallClock(startTime, zone)} required className={`${inputClass} tabular-nums`} /><span className="font-normal">{zone.replaceAll('_', ' ')}</span></label>
        <label className={fieldLabelClass}>Reason<input name="reason" required maxLength={1000} className={inputClass} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          <button type="submit" disabled={pending || !key} className={pillClass('primary')}><CalendarClock />{pending ? 'Rescheduling…' : 'Save new time'}</button>
        </div>
        {state.status !== 'idle' ? <p role={state.status === 'success' ? 'status' : 'alert'} className={`text-sm ${state.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
