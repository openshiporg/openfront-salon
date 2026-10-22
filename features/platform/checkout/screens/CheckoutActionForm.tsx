'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RotateCw } from 'lucide-react';
import type { CheckoutMutationFeedback } from '../lib/checkoutMutationFeedback';
import { pillClass, trackClass } from '../../components/pill';

export function CheckoutActionForm({
  action,
  children,
  alreadyCheckedOut,
}: {
  action: (formData: FormData) => Promise<CheckoutMutationFeedback>;
  children: ReactNode;
  alreadyCheckedOut: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'success' | 'failure'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [refreshPending, startRefresh] = useTransition();
  const pending = submitting || refreshPending;

  const submitAction = async (formData: FormData) => {
    setSubmitting(true);
    try {
      const result = await action(formData);
      setState(result.status);
    } catch {
      setState('failure');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshStatus = () => {
    setState('idle');
    startRefresh(() => router.refresh());
  };
  const needsRefresh = state === 'failure';
  const submitLabel = alreadyCheckedOut
    ? 'Already paid'
    : pending
      ? 'Recording checkout…'
      : needsRefresh
        ? 'Refresh before retry'
        : state === 'success'
          ? 'Checkout recorded'
          : 'Complete checkout';

  return (
    <form action={submitAction} aria-busy={pending}>
      {children}
      <div className={`${trackClass} mt-4 flex w-full`}>
        <button
          type="submit"
          disabled={alreadyCheckedOut || pending || state !== 'idle'}
          className={`${pillClass('primary')} h-10 flex-1`}
        >
          <Check />
          {submitLabel}
        </button>
      </div>
      {state === 'failure' && (
        <div role="alert" className="mt-3 grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p>Checkout result not confirmed. Refresh to verify status before trying again.</p>
          <div className={trackClass}>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={refreshPending}
              aria-label="Refresh checkout status before trying again"
              className={pillClass('raised', 'sm')}
            >
              <RotateCw />
              {refreshPending ? 'Refreshing…' : 'Refresh checkout status'}
            </button>
          </div>
        </div>
      )}
      {state === 'success' && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">Checkout recorded.</p>}
    </form>
  );
}
