'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { depositCheckFeedback, type ConfirmPaymentResult } from '../lib/depositRefund';

/** Asks Stripe whether an online deposit was paid: confirmPayment reads the Checkout back and settles it. */
export async function checkDepositPayment(input: { paymentSessionId: string; appointmentId: string; amountLabel: string }): Promise<{ ok: boolean; text: string; status?: string | null }> {
  if (!input.paymentSessionId) return { ok: false, text: 'No online deposit to check.' };
  const response = await keystoneClient<{ confirmPayment: ConfirmPaymentResult }>(`
    mutation CheckDepositPayment($id: ID!) { confirmPayment(paymentSessionId: $id) { success error status } }
  `, { id: input.paymentSessionId });
  const result: ConfirmPaymentResult = response.success && response.data?.confirmPayment
    ? response.data.confirmPayment
    : { success: false, error: response.success ? null : response.error || 'You need payment access to do this.' };
  if (result.success) {
    revalidatePath(`/dashboard/platform/appointments/${input.appointmentId}`);
    revalidatePath('/dashboard/platform/appointments');
  }
  return { ...depositCheckFeedback(result, input.amountLabel), status: result.status };
}
