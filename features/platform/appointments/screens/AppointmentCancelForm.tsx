'use client';

import { useActionState, useState } from 'react';
import { cancelAppointmentFromQueue } from '../actions/appointments';
import type { AppointmentTransitionFormState } from '../lib/appointmentTransitionFeedback';

export function AppointmentCancelForm({
  id,
  variant,
  cancellationReason = 'Cancelled from appointment detail',
}: {
  id: string;
  variant: 'queue' | 'detail';
  cancellationReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previousState: AppointmentTransitionFormState, formData: FormData) => cancelAppointmentFromQueue(formData),
    { status: 'idle' } as AppointmentTransitionFormState,
  );
  const [reason, setReason] = useState('');
  const isQueue = variant === 'queue';
  const buttonLabel = pending
    ? 'Cancelling…'
    : state.status === 'failure'
      ? 'Retry cancellation'
      : isQueue
        ? 'Cancel'
        : 'Cancel appointment';

  return (
    <form action={formAction} className={isQueue ? 'grid gap-2 rounded-lg border bg-muted/30 p-2' : 'grid gap-2'}>
      <input type="hidden" name="id" value={id} />
      {isQueue ? (
        <input
          name="cancellationReason"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          placeholder="Cancellation reason"
          aria-label="Cancellation reason"
          className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input type="hidden" name="cancellationReason" value={cancellationReason} />
      )}
      <button
        type="submit"
        disabled={pending}
        className={`disabled:cursor-wait disabled:opacity-60 ${
          isQueue
            ? 'rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100'
            : 'w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100'
        }`}
      >
        {buttonLabel}
      </button>
      {state.status === 'failure' && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
          The cancellation could not be confirmed. Retry to recheck the appointment status.
        </p>
      )}
      {state.status === 'success' && <p role="status" className="text-xs text-emerald-800">Appointment cancellation confirmed.</p>}
    </form>
  );
}
