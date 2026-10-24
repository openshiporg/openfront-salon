'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { fail, operationKey, workflowState, type FormState } from '@/features/platform/lib/formState';

function refresh(appointmentId: string) {
  revalidatePath(`/dashboard/platform/appointments/${appointmentId}`);
  revalidatePath('/dashboard/platform/appointments');
}

/** Records a deposit the salon collected (terminal or cash) through the manual provider. */
export async function recordDeposit(_previous: FormState, formData: FormData): Promise<FormState> {
  const appointmentId = String(formData.get('appointmentId') || '');
  const paymentMethod = String(formData.get('paymentMethod') || '');
  if (!paymentMethod) return fail('Choose how the deposit was paid.');
  const response = await keystoneClient<{ processAppointmentDeposit: { success: boolean; error?: string | null } }>(`
    mutation RecordDeposit($appointmentId: ID!, $paymentMethod: String!, $idempotencyKey: String!) {
      processAppointmentDeposit(appointmentId: $appointmentId, paymentMethod: $paymentMethod, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { appointmentId, paymentMethod, idempotencyKey: String(formData.get('idempotencyKey') || operationKey('desk-deposit')) });
  const state = workflowState(response, 'processAppointmentDeposit', 'Deposit recorded.', 'The deposit could not be recorded. Check your payment access.');
  if (state.status === 'success') refresh(appointmentId);
  return state;
}

/** Starts, completes or skips one planned step (for example colour processing). */
export async function transitionSegment(_previous: FormState, formData: FormData): Promise<FormState> {
  const appointmentId = String(formData.get('appointmentId') || '');
  const segmentId = String(formData.get('segmentId') || '');
  const status = String(formData.get('status') || '');
  const reason = String(formData.get('reason') || '').trim() || (status === 'started' ? 'Started' : status === 'completed' ? 'Completed' : 'Skipped');
  const response = await keystoneClient<{ transitionAppointmentSegment: { success: boolean; error?: string | null } }>(`
    mutation TransitionSegment($segmentId: ID!, $status: String!, $reason: String!, $idempotencyKey: String!) {
      transitionAppointmentSegment(segmentId: $segmentId, status: $status, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { segmentId, status, reason, idempotencyKey: operationKey('segment-transition') });
  const state = workflowState(response, 'transitionAppointmentSegment', 'Updated.', 'The step could not be updated.');
  if (state.status === 'success') refresh(appointmentId);
  return state;
}
