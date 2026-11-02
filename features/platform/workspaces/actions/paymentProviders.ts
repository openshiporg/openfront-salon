'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getPlatformActor } from '../../lib/getPlatformActor';

export type StripeSetupStatus = { keyConfigured: boolean; canManagePayments: boolean };

/** Whether "Set up Stripe" can be offered: the server holds a Stripe key and the viewer has payment authority. */
export async function getStripeSetupStatus(): Promise<StripeSetupStatus> {
  const actor = await getPlatformActor();
  const role = actor.success ? actor.data?.authenticatedItem?.role : null;
  return {
    keyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    canManagePayments: role?.canManageSalon === true || role?.canManagePayments === true,
  };
}

/** Switches the salon's existing Stripe provider on. Only isInstalled is written; the model enforces the rest. */
export async function setUpStripeAction(): Promise<{ success: boolean; error?: string }> {
  if (!process.env.STRIPE_SECRET_KEY) return { success: false, error: 'Stripe needs STRIPE_SECRET_KEY set on the server first.' };
  const found = await keystoneClient<{ paymentProviders: Array<{ id: string; isInstalled: boolean }> }>(
    `query StripeProvider { paymentProviders(where: { adapter: { equals: stripe } }, take: 1) { id isInstalled } }`,
  );
  if (!found.success) return { success: false, error: found.error || 'Unable to read payment providers.' };
  const provider = found.data.paymentProviders[0];
  if (!provider) return { success: false, error: 'No Stripe provider exists yet. Run onboarding to add it.' };
  if (!provider.isInstalled) {
    const result = await keystoneClient<{ updatePaymentProvider: { id: string } | null }>(
      `mutation SetUpStripe($id: ID!) { updatePaymentProvider(where: { id: $id }, data: { isInstalled: true }) { id } }`,
      { id: provider.id },
    );
    if (!result.success || !result.data?.updatePaymentProvider) return { success: false, error: (result.success ? null : result.error) || 'You need payment access to do this.' };
  }
  revalidatePath('/dashboard/platform/integrations');
  revalidatePath('/book');
  return { success: true };
}
