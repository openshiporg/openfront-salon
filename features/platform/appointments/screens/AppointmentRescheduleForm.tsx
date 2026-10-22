'use client';

import { useActionState, useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { rescheduleOperatorAppointment, type RescheduleState } from '../actions/rescheduleAppointment';
import { fieldLabelClass, inputClass, pillClass, trackClass } from '../../components/pill';

export function AppointmentRescheduleForm({ id, startTime }: { id: string; startTime: string }) {
  const [key, setKey] = useState('');
  const [state, action, pending] = useActionState<RescheduleState, FormData>(rescheduleOperatorAppointment, { status: 'idle', message: '' });
  useEffect(() => { setKey(`operator-reschedule:${crypto.randomUUID()}`); }, []);
  useEffect(() => { if (state.status === 'success') setKey(`operator-reschedule:${crypto.randomUUID()}`); }, [state]);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldLabelClass}>New start · ISO 8601 with UTC offset<input name="startTime" defaultValue={startTime} required className={`${inputClass} font-mono text-[13px]`} /></label>
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
