'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { pillClass, trackClass } from '../../components/pill';
import { refundDeposit } from '../actions/depositRefund';

/** "Refund deposit" with a confirm step. The key is minted once per opened dialog, so a retried click replays instead of refunding twice. */
export function RefundDepositButton({ paymentSessionId, appointmentId, amountLabel, client }: {
  paymentSessionId: string;
  appointmentId: string;
  amountLabel: string;
  client: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    const idempotencyKey = key || `deposit-refund:${crypto.randomUUID()}`;
    start(async () => {
      const result = await refundDeposit({ paymentSessionId, appointmentId, idempotencyKey, amountLabel });
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <AlertDialog onOpenChange={(open) => { if (open) setKey(`deposit-refund:${crypto.randomUUID()}`); }}>
        <div className={trackClass}>
          <AlertDialogTrigger asChild>
            <button type="button" disabled={pending} className={pillClass('danger', 'sm')}><Undo2 />{pending ? 'Refunding…' : 'Refund deposit'}</button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund {amountLabel} deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              {client}&rsquo;s card deposit of {amountLabel} goes back to the card it was paid with. This can&rsquo;t be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep deposit</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Refund {amountLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {message ? <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{message.text}</p> : null}
    </div>
  );
}
