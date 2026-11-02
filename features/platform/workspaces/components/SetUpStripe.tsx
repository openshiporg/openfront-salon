'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
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
import { setUpStripeAction } from '../actions/paymentProviders';

/** "Set up Stripe" on the payment providers table, with a confirm step: it turns on card deposits at booking. */
export function SetUpStripe() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const result = await setUpStripeAction();
      setError(result.success ? '' : result.error || 'Unable to set up Stripe.');
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <AlertDialog>
        <div className={trackClass}>
          <AlertDialogTrigger asChild>
            <button type="button" disabled={pending} className={pillClass('primary', 'sm')}><CreditCard />{pending ? 'Setting up…' : 'Set up Stripe'}</button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up Stripe for online payments?</AlertDialogTitle>
            <AlertDialogDescription>
              Clients booking a service that needs a deposit will pay it by card on Stripe, and staff can refund it from the appointment. In-salon payments are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Set up Stripe</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <p role="alert" className="w-full text-right text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
