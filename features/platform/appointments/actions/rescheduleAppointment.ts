'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getPlatformActor } from '@/features/platform/lib/getPlatformActor';
import { parseExplicitIsoInstant } from '@/features/lib/parseExplicitIsoInstant';

export type RescheduleState = { status: 'idle' | 'success' | 'error'; message: string };
export async function rescheduleOperatorAppointment(_previous: RescheduleState, formData: FormData): Promise<RescheduleState> {
  const authenticated = await getPlatformActor();
  const actor = authenticated.success ? authenticated.data?.authenticatedItem : null;
  if (!actor?.role?.canManageSalon && !actor?.role?.canManageAppointments) return { status: 'error', message: 'Appointment permission required.' };
  const id = String(formData.get('appointmentId') || '');
  const startTime = parseExplicitIsoInstant(formData.get('startTime'));
  const reason = String(formData.get('reason') || '').trim();
  const idempotencyKey = String(formData.get('idempotencyKey') || '');
  if (!id || !startTime || !reason || reason.length > 1000 || idempotencyKey.length < 12 || idempotencyKey.length > 200) return { status: 'error', message: 'Enter a start time with a UTC offset and a reason.' };
  await keystoneClient(`mutation RescheduleOperatorAppointment($id:ID!, $start:String!, $reason:String!, $key:String!) {
    scheduleAppointmentSegments(appointmentId:$id,startTime:$start,reason:$reason,idempotencyKey:$key){success appointmentId revision error}
  }`, { id, start: startTime, reason, key: idempotencyKey });
  // A transport/hook failure is not rollback. Verify the exact original revision
  // and the current appointment through normal scoped generated reads.
  const read = await keystoneClient<{ appointment: { startTime: string; scheduleRevisions: { nextStart: string }[] } | null }>(`query VerifyOperatorReschedule($id:ID!, $key:String!) {
    appointment(where:{id:$id}) {startTime scheduleRevisions(where:{idempotencyKey:{equals:$key}},take:2){nextStart}}
  }`, { id, key: idempotencyKey });
  const record = read.success ? read.data.appointment : null;
  if (!record || record.scheduleRevisions.length !== 1 || Date.parse(record.startTime) !== Date.parse(startTime) || Date.parse(record.scheduleRevisions[0].nextStart) !== Date.parse(startTime)) return { status: 'error', message: 'Reschedule not verified. Retry the same operation before changing its details.' };
  revalidatePath('/dashboard/platform/appointments');
  revalidatePath(`/dashboard/platform/appointments/${id}`);
  revalidatePath('/account');
  return { status: 'success', message: 'Appointment rescheduled.' };
}
