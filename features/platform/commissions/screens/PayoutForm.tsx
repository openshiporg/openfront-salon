'use client';

import { useState } from 'react';
import { inputClass, pillClass, trackClass } from '../../components/pill';

/** Two-step payout: the first press asks for confirmation and an optional reference. */
export function PayoutForm({ action, field, value, label, amount }: { action: (formData: FormData) => Promise<void>; field: 'id' | 'stylistId'; value: string; label: string; amount: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <div className={trackClass}>
        <button type="button" onClick={() => setConfirming(true)} className={pillClass(field === 'stylistId' ? 'primary' : 'raised', 'sm')}>{label}</button>
      </div>
    );
  }

  return (
    <form action={async (formData) => { setPending(true); try { await action(formData); } finally { setPending(false); setConfirming(false); } }} className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <input type="hidden" name={field} value={value} />
      <label className="min-w-0 flex-1 sm:w-40 sm:flex-none"><span className="sr-only">Payout reference</span><input name="reference" maxLength={200} placeholder="Reference (optional)" className={`${inputClass} h-8 rounded-lg text-xs`} /></label>
      <div className={trackClass}>
        <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={pillClass('quiet', 'sm')}>Cancel</button>
        <button type="submit" disabled={pending} className={pillClass('primary', 'sm')}>{pending ? 'Paying…' : `Pay ${amount}`}</button>
      </div>
    </form>
  );
}
