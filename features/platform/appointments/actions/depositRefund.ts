'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { depositRefundFeedback, type DepositRefundResult } from '../lib/depositRefund';

/** Refunds an online card deposit through the existing deposit refund workflow (refundPayment → refundAppointmentDeposit). */
export async function refundDeposit(input: { paymentSessionId: string; appointmentId: string; idempotencyKey: string; amountLabel: string }): Promise<{ ok: boolean; message: string }> {
  if (!input.paymentSessionId || !input.idempotencyKey) return { ok: false, message: 'Request key is missing. Reload and try again.' };
  const response = await keystoneClient<{ refundPayment: DepositRefundResult }>(`
    mutation RefundDeposit($id: ID!, $key: String!, $reason: String!) {
      refundPayment(paymentSessionId: $id, idempotencyKey: $key, reason: $reason) { success error status refundId }
    }
  `, { id: input.paymentSessionId, key: input.idempotencyKey, reason: 'Deposit refunded from the appointment page' });
  const result: DepositRefundResult = response.success && response.data?.refundPayment
    ? response.data.refundPayment
    : { success: false, error: response.success ? null : response.error || 'You need refund access to do this.' };
  if (result.success) {
    revalidatePath(`/dashboard/platform/appointments/${input.appointmentId}`);
    revalidatePath('/dashboard/platform/appointments');
  }
  const settled = result.success && (result.status === 'refunded' || result.status === 'partially_refunded');
  return { ok: settled, message: depositRefundFeedback(result, input.amountLabel) };
}
