'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { pillClass, trackClass } from '../../components/pill';
import { checkDepositPayment } from '../actions/depositCheck';

/** "Check payment with Stripe" for an online deposit still waiting on the customer. Read-only on Stripe's side, so no confirm step. */
export function CheckDepositButton({ paymentSessionId, appointmentId, amountLabel }: { paymentSessionId: string; appointmentId: string; amountLabel: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function check() {
    start(async () => {
      const result = await checkDepositPayment({ paymentSessionId, appointmentId, amountLabel });
      setMessage(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">An online card checkout for {amountLabel} is open. If the client says they paid, check with Stripe.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className={trackClass}>
          <button type="button" onClick={check} disabled={pending} className={pillClass('raised', 'sm')}><RefreshCw />{pending ? 'Checking…' : 'Check payment with Stripe'}</button>
        </div>
        {message ? <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{message.text}</p> : null}
      </div>
    </div>
  );
}
