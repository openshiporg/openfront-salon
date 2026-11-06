'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type DeskCardState = { success: boolean; error: string | null; sessionId: string | null; url: string | null; amount: number | null; status: string | null; recorded: boolean };
const FIELDS = 'success error sessionId url amount status recorded';
const unavailable: DeskCardState = { success: false, error: 'Card payment could not be reached. Refresh and try again.', sessionId: null, url: null, amount: null, status: null, recorded: false };

function refresh(appointmentId?: string) {
  revalidatePath('/dashboard/platform/checkout');
  if (appointmentId) {
    revalidatePath(`/dashboard/platform/checkout/${appointmentId}`);
    revalidatePath(`/dashboard/platform/appointments/${appointmentId}`);
  }
  revalidatePath('/dashboard/platform/appointments');
}

/** Prices the visit from the checkout form and opens a Stripe card page for that total. */
export async function startDeskCard(formData: FormData): Promise<DeskCardState> {
  const appointmentId = formData.get('appointmentId')?.toString() || '';
  const retailProductIds = formData.getAll('retailProductId').map(String);
  const retailQuantities = formData.getAll('retailQuantity').map((value) => Number(value || 0));
  const retailItems = retailProductIds.map((productId, index) => ({ productId, quantity: retailQuantities[index] || 0 })).filter((item) => item.productId && item.quantity > 0);
  const response = await keystoneClient<{ startDeskCardPayment: DeskCardState }>(`
    mutation StartDeskCard($appointmentId: ID!, $tipAmount: Int!, $discountAmount: Int!, $retailItems: JSON, $clientPackageId: ID, $clientMembershipId: ID) {
      startDeskCardPayment(appointmentId: $appointmentId, tipAmount: $tipAmount, discountAmount: $discountAmount, retailItems: $retailItems, clientPackageId: $clientPackageId, clientMembershipId: $clientMembershipId) { ${FIELDS} }
    }
  `, {
    appointmentId,
    tipAmount: Math.round(Number(formData.get('tip') || 0) * 100),
    discountAmount: Math.round(Number(formData.get('discount') || 0) * 100),
    retailItems,
    clientPackageId: formData.get('clientPackageId')?.toString() || null,
    clientMembershipId: formData.get('clientMembershipId')?.toString() || null,
  });
  return response.success ? response.data.startDeskCardPayment : unavailable;
}

export async function checkDeskCard(sessionId: string, appointmentId: string): Promise<DeskCardState> {
  const response = await keystoneClient<{ checkDeskCardPayment: DeskCardState }>(`mutation CheckDeskCard($id: ID!) { checkDeskCardPayment(sessionId: $id) { ${FIELDS} } }`, { id: sessionId });
  const state = response.success ? response.data.checkDeskCardPayment : unavailable;
  if (state.recorded) refresh(appointmentId);
  return state;
}

export async function cancelDeskCard(sessionId: string, appointmentId: string): Promise<DeskCardState> {
  const response = await keystoneClient<{ cancelDeskCardPayment: DeskCardState }>(`mutation CancelDeskCard($id: ID!) { cancelDeskCardPayment(sessionId: $id) { ${FIELDS} } }`, { id: sessionId });
  refresh(appointmentId);
  return response.success ? response.data.cancelDeskCardPayment : unavailable;
}

export async function getDeskCard(appointmentId: string): Promise<DeskCardState | null> {
  const response = await keystoneClient<{ deskCardPayment: DeskCardState }>(`query DeskCard($id: ID!) { deskCardPayment(appointmentId: $id) { ${FIELDS} } }`, { id: appointmentId });
  return response.success ? response.data.deskCardPayment : null;
}
