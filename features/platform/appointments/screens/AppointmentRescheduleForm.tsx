'use client';

import { useActionState, useEffect, useState } from 'react';
import { rescheduleOperatorAppointment, type RescheduleState } from '../actions/rescheduleAppointment';

export function AppointmentRescheduleForm({ id, startTime }: { id: string; startTime: string }) {
  const [key, setKey] = useState('');
  const [state, action, pending] = useActionState<RescheduleState, FormData>(rescheduleOperatorAppointment, { status: 'idle', message: '' });
  useEffect(() => { setKey(`operator-reschedule:${crypto.randomUUID()}`); }, []);
  useEffect(() => { if (state.status === 'success') setKey(`operator-reschedule:${crypto.randomUUID()}`); }, [state]);
  return <form action={action} className="grid gap-3 rounded-xl border bg-background p-4">
    <h2 className="font-semibold">Reschedule appointment</h2>
    <input type="hidden" name="appointmentId" value={id} />
    <input type="hidden" name="idempotencyKey" value={key} />
    <label className="grid gap-1 text-sm">New start · ISO 8601 with UTC offset<input name="startTime" defaultValue={startTime} required className="min-h-11 min-w-0 rounded-md border bg-background px-3" /></label>
    <label className="grid gap-1 text-sm">Reason<input name="reason" required maxLength={1000} className="min-h-11 min-w-0 rounded-md border bg-background px-3" /></label>
    <button type="submit" disabled={pending || !key} className="min-h-11 rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">{pending ? 'Rescheduling…' : 'Save appointment time'}</button>
    {state.status !== 'idle' ? <p role={state.status === 'success' ? 'status' : 'alert'} className="text-sm">{state.message}</p> : null}
  </form>;
}
