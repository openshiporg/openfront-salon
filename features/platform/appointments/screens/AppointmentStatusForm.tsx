'use client';

import { useActionState } from 'react';
import { transitionAppointmentStatus } from '../actions/appointments';
import type { AppointmentTransitionFormState } from '../lib/appointmentTransitionFeedback';
import { RetryAppointmentQueueButton } from './RetryAppointmentQueueButton';

export function AppointmentStatusForm({
  id,
  status,
  label,
  primary = false,
}: {
  id: string;
  status: string;
  label: string;
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previousState: AppointmentTransitionFormState, formData: FormData) => transitionAppointmentStatus(formData),
    { status: 'idle' } as AppointmentTransitionFormState,
  );

  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        disabled={pending}
        className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${
          primary
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'border bg-background hover:bg-muted'
        }`}
      >
        {pending ? 'Updating…' : label}
      </button>
      {state.status === 'failure' && (
        <div role="alert" className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
          <p>The status update could not be confirmed. Refresh the queue, then retry if the status is unchanged.</p>
          <RetryAppointmentQueueButton />
        </div>
      )}
      {state.status === 'success' && <p role="status" className="text-xs text-emerald-800">Appointment status updated.</p>}
    </form>
  );
}
