'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckoutMutationFeedback } from '../lib/checkoutMutationFeedback';

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
    <form action={submitAction} aria-busy={pending} className="rounded-2xl border bg-muted/20 p-4">
      {children}
      <button
        type="submit"
        disabled={alreadyCheckedOut || pending || state !== 'idle'}
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
      {state === 'failure' && (
        <div role="alert" className="mt-3 grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <p>Checkout result could not be confirmed. Refresh this view to verify status before attempting again.</p>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={refreshPending}
            aria-label="Refresh checkout status before trying again"
            className="inline-flex min-h-10 items-center justify-center border border-amber-900 bg-background px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            {refreshPending ? 'Refreshing…' : 'Refresh checkout status'}
          </button>
        </div>
      )}
      {state === 'success' && <p role="status" className="mt-3 text-xs text-emerald-800">Checkout recorded.</p>}
    </form>
  );
}
