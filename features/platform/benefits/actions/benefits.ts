'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { dollarsToCents, fail, ok, operationKey, workflowState, type FormState } from '@/features/platform/lib/formState';

export interface MembershipPlan { id: string; name: string; description?: string | null; monthlyPrice: number; discountPercent?: number | null; isActive?: boolean | null; includedServices: { id: string; name?: string | null }[] }
export interface PackagePlan { id: string; name: string; description?: string | null; totalPrice: number; savingsAmount?: number | null; validDays?: number | null; isActive?: boolean | null; services: { id: string; name?: string | null }[] }
export interface Enrollment { id: string; status?: string | null; startDate?: string | null; nextBillingDate?: string | null; pausedUntil?: string | null; client?: { id: string; name?: string | null; email?: string | null } | null; membership?: { name?: string | null } | null }
export interface OwnedPackage { id: string; status?: string | null; purchasedAt?: string | null; expiresAt?: string | null; totalValue: number; usedValue?: number | null; client?: { id: string; name?: string | null; email?: string | null } | null; package?: { name?: string | null } | null }

export async function getBenefits() {
  const response = await keystoneClient<{
    memberships: MembershipPlan[]; servicePackages: PackagePlan[]; clientMemberships: Enrollment[]; clientPackages: OwnedPackage[];
    services: { id: string; name: string }[]; clients: { user?: { id: string; name?: string | null; email?: string | null } | null }[];
  }>(`
    query Benefits {
      memberships(orderBy: { name: asc }, take: 100) { id name description monthlyPrice discountPercent isActive includedServices { id name } }
      servicePackages(orderBy: { name: asc }, take: 100) { id name description totalPrice savingsAmount validDays isActive services { id name } }
      clientMemberships(orderBy: { startDate: desc }, take: 200) { id status startDate nextBillingDate pausedUntil client { id name email } membership { name } }
      clientPackages(orderBy: { purchasedAt: desc }, take: 200) { id status purchasedAt expiresAt totalValue usedValue client { id name email } package { name } }
      services(where: { status: { equals: active } }, orderBy: { name: asc }, take: 200) { id name }
      clients(where: { user: { email: { not: { equals: "" } } } }, orderBy: { updatedAt: desc }, take: 500) { user { id name email } }
    }
  `);
  if (!response.success) return null;
  return {
    ...response.data,
    accounts: (response.data.clients || []).flatMap((client) => client.user ? [{ id: client.user.id, label: `${client.user.name || client.user.email} · ${client.user.email}` }] : []),
  };
}

function refresh() {
  revalidatePath('/dashboard/platform/benefits');
  revalidatePath('/dashboard/platform/checkout');
  revalidatePath('/memberships');
}

/** Creates or edits a membership plan or package; plans are catalog records with list-level access. */
export async function savePlan(_previous: FormState, formData: FormData): Promise<FormState> {
  const kind = String(formData.get('kind') || '');
  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const price = dollarsToCents(formData.get('price'));
  const serviceIds = formData.getAll('serviceIds').map(String).filter(Boolean);
  const isActive = formData.get('isActive') === 'true';
  if (!name) return fail('Enter a name.');
  if (price === null) return fail('Enter the price in dollars.');
  const services = (key: string) => ({ [key]: id ? { set: serviceIds.map((serviceId) => ({ id: serviceId })) } : { connect: serviceIds.map((serviceId) => ({ id: serviceId })) } });
  let data: Record<string, unknown>;
  if (kind === 'membership') {
    const discountPercent = Number(formData.get('discountPercent') || 0);
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) return fail('Discount must be a whole percent from 0 to 100.');
    data = { name, description, monthlyPrice: price, discountPercent, isActive, ...services('includedServices') };
  } else if (kind === 'package') {
    const savings = dollarsToCents(formData.get('savings') || '0');
    const validDays = Number(formData.get('validDays') || 0);
    if (savings === null) return fail('Enter savings in dollars.');
    if (!Number.isInteger(validDays) || validDays < 0 || validDays > 3650) return fail('Valid days must be a whole number.');
    if (!serviceIds.length) return fail('Choose the services the package covers.');
    data = { name, description, totalPrice: price, savingsAmount: savings, validDays: validDays || null, isActive, ...services('services') };
  } else return fail('Unknown plan type.');
  const list = kind === 'membership' ? 'Membership' : 'ServicePackage';
  const response = id
    ? await keystoneClient(`mutation UpdatePlan($id: ID!, $data: ${list}UpdateInput!) { update${list}(where: { id: $id }, data: $data) { id } }`, { id, data })
    : await keystoneClient(`mutation CreatePlan($data: ${list}CreateInput!) { create${list}(data: $data) { id } }`, { data });
  if (!response.success) return fail('The plan could not be saved. Check your catalog access.');
  refresh();
  return ok(id ? 'Plan saved.' : 'Plan created.');
}

export async function sellBenefit(_previous: FormState, formData: FormData): Promise<FormState> {
  const [kind, planId] = String(formData.get('plan') || '').split(':');
  const clientUserId = String(formData.get('clientUserId') || '');
  const paymentMethod = String(formData.get('paymentMethod') || '');
  if (!kind || !planId) return fail('Choose a plan.');
  if (!clientUserId) return fail('Choose a client.');
  if (!paymentMethod) return fail('Choose how it was paid.');
  const response = await keystoneClient<{ sellClientBenefit: { success: boolean; error?: string | null } }>(`
    mutation SellBenefit($kind: String!, $planId: ID!, $clientUserId: ID!, $paymentMethod: String!, $idempotencyKey: String!) {
      sellClientBenefit(kind: $kind, planId: $planId, clientUserId: $clientUserId, paymentMethod: $paymentMethod, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { kind, planId, clientUserId, paymentMethod, idempotencyKey: String(formData.get('idempotencyKey') || operationKey('benefit-sale')) });
  const state = workflowState(response, 'sellClientBenefit', kind === 'membership' ? 'Client enrolled.' : 'Package sold.', 'The sale could not be recorded. Check your client and payment access.');
  if (state.status === 'success') refresh();
  return state;
}

export async function setBenefitStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  const response = await keystoneClient<{ setClientBenefitStatus: { success: boolean; error?: string | null } }>(`
    mutation SetBenefitStatus($kind: String!, $id: ID!, $status: String!, $pausedUntil: String) {
      setClientBenefitStatus(kind: $kind, id: $id, status: $status, pausedUntil: $pausedUntil) { success error }
    }
  `, { kind: String(formData.get('kind') || ''), id: String(formData.get('id') || ''), status: String(formData.get('status') || ''), pausedUntil: String(formData.get('pausedUntil') || '') || null });
  const state = workflowState(response, 'setClientBenefitStatus', 'Updated.', 'The change could not be saved.');
  if (state.status === 'success') refresh();
  return state;
}
