'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, LogIn, UserX, X } from 'lucide-react';
import { cancelAppointmentFromQueue, transitionAppointmentStatus } from '../actions/appointments';
import { inputClass, pillClass, trackClass } from '../../components/pill';

type Feedback = { kind: 'success' | 'failure'; text: string } | null;

/**
 * Lifecycle controls for one appointment: confirm → check in, no-show and
 * cancel. Every control is a raised pill in one recessed track; outcomes are
 * reported under the track so the pills never reflow.
 */
export function AppointmentActions({
  id,
  status,
  size = 'md',
  cancellationReason,
}: {
  id: string;
  status?: string | null;
  size?: 'sm' | 'md';
  /** Fixed reason (detail page). When omitted, the operator types one. */
  cancellationReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [, startRefresh] = useTransition();

  if (status === 'cancelled' || status === 'completed' || status === 'no_show') return null;

  async function run(key: string, label: string, perform: () => Promise<{ status: 'success' | 'failure' }>) {
    setBusy(key);
    setFeedback(null);
    try {
      const result = await perform();
      if (result.status === 'success') {
        setFeedback({ kind: 'success', text: label });
        setCancelling(false);
        startRefresh(() => router.refresh());
      } else {
        setFeedback({ kind: 'failure', text: 'Update not confirmed. Refresh, then retry if the status is unchanged.' });
      }
    } catch {
      setFeedback({ kind: 'failure', text: 'Update not confirmed. Refresh, then retry if the status is unchanged.' });
    } finally {
      setBusy(null);
    }
  }

  function transition(next: string, label: string) {
    const formData = new FormData();
    formData.set('id', id);
    formData.set('status', next);
    return run(next, label, () => transitionAppointmentStatus(formData));
  }

  function cancel() {
    const formData = new FormData();
    formData.set('id', id);
    formData.set('cancellationReason', cancellationReason || reason.trim() || 'Cancelled by salon');
    return run('cancelled', 'Appointment cancelled.', () => cancelAppointmentFromQueue(formData));
  }

  const pending = busy !== null;

  return (
    <div className="grid min-w-0 justify-items-start gap-2">
      <div className={trackClass} role="group" aria-label="Appointment actions">
        {status === 'pending' && (
          <button type="button" disabled={pending} onClick={() => transition('confirmed', 'Appointment confirmed.')} className={pillClass('primary', size)}>
            <Check />{busy === 'confirmed' ? 'Confirming…' : 'Confirm'}
          </button>
        )}
        {status === 'confirmed' && (
          <button type="button" disabled={pending} onClick={() => transition('in_progress', 'Client checked in.')} className={pillClass('primary', size)}>
            <LogIn />{busy === 'in_progress' ? 'Checking in…' : 'Check in'}
          </button>
        )}
        {(status === 'pending' || status === 'confirmed') && (
          <button type="button" disabled={pending} onClick={() => transition('no_show', 'Marked as no-show.')} className={pillClass('raised', size)}>
            <UserX />{busy === 'no_show' ? 'Saving…' : 'No-show'}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          aria-expanded={cancellationReason ? undefined : cancelling}
          onClick={() => (cancellationReason ? void cancel() : setCancelling((value) => !value))}
          className={pillClass(cancelling ? 'quiet' : 'danger', size)}
        >
          {cancelling ? <X /> : <Ban />}{busy === 'cancelled' ? 'Cancelling…' : cancelling ? 'Keep' : 'Cancel'}
        </button>
      </div>

      {cancelling && !cancellationReason ? (
        <div className="flex w-full min-w-0 max-w-sm items-center gap-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="Cancellation reason"
            aria-label="Cancellation reason"
            maxLength={1000}
            className={`${inputClass} h-9`}
          />
          <div className={trackClass}>
            <button type="button" disabled={pending} onClick={() => void cancel()} className={pillClass('danger', 'sm')}>
              {busy === 'cancelled' ? 'Cancelling…' : 'Cancel visit'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p role={feedback.kind === 'failure' ? 'alert' : 'status'} className={feedback.kind === 'failure' ? 'max-w-sm text-xs text-amber-800 dark:text-amber-300' : 'text-xs text-emerald-700 dark:text-emerald-400'}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
