'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { pillClass, trackClass } from './pill';
import type { FormState } from '../lib/formState';

const idle: FormState = { status: 'idle', message: '' };

/**
 * One server-action form for platform create, edit and transition actions:
 * the submit pill sits in a recessed track and the outcome reads beside it.
 * `confirm` turns the submit into a two-step press for irreversible actions.
 */
export function ActionForm({
  action, children, submitLabel, pendingLabel, variant = 'primary', resetOnSuccess = false, confirm, className = 'grid gap-3', size = 'sm',
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'raised' | 'danger';
  resetOnSuccess?: boolean;
  confirm?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'success' && resetOnSuccess) ref.current?.reset();
    setArmed(false);
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          {confirm && !armed ? (
            <button type="button" onClick={() => setArmed(true)} className={pillClass(variant, size)}>{submitLabel}</button>
          ) : (
            <>
              {confirm ? <button type="button" onClick={() => setArmed(false)} disabled={pending} className={pillClass('quiet', size)}>Cancel</button> : null}
              <button type="submit" disabled={pending} className={pillClass(variant, size)}>{pending ? pendingLabel || 'Saving…' : confirm || submitLabel}</button>
            </>
          )}
        </div>
        {state.status !== 'idle' ? (
          <p role={state.status === 'success' ? 'status' : 'alert'} className={`text-sm ${state.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
