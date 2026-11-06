'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { keystoneContext } from '@/features/keystone/context';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { getPlatformActor } from '../../lib/getPlatformActor';

export type StripeEnvVar = { name: string; purpose: string; set: boolean };
export type StripeSetupStatus = {
  keyConfigured: boolean;
  canManagePayments: boolean;
  /** E-commerce preset: the variables Stripe needs, with whether each is set (never the value). */
  envVars: StripeEnvVar[];
  webhookUrl: string;
  webhookEvents: string[];
};

/** Every Stripe event the salon's webhook settles: deposits, desk card, gift cards, memberships, refunds. */
const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'invoice.paid',
];

async function siteOrigin() {
  const list = await headers();
  const host = list.get('x-forwarded-host') || list.get('host') || 'localhost:3000';
  const proto = list.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** What "Set up Stripe" needs, E-commerce style: env vars, the webhook endpoint, and payment authority. */
export async function getStripeSetupStatus(): Promise<StripeSetupStatus> {
  const actor = await getPlatformActor();
  const role = actor.success ? actor.data?.authenticatedItem?.role : null;
  return {
    keyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    canManagePayments: role?.canManageSalon === true || role?.canManagePayments === true,
    envVars: [
      { name: 'STRIPE_SECRET_KEY', purpose: 'Creates card pages and refunds', set: Boolean(process.env.STRIPE_SECRET_KEY) },
      { name: 'STRIPE_WEBHOOK_SECRET', purpose: 'Verifies Stripe’s payment confirmations', set: Boolean(process.env.STRIPE_WEBHOOK_SECRET) },
    ],
    webhookUrl: `${await siteOrigin()}/api/payments/webhooks/pp_stripe`,
    webhookEvents: STRIPE_WEBHOOK_EVENTS,
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
  if (!provider) {
    // Onboarding normally seeds it; if it never ran, add the same pp_stripe row (code-owned fields, so sudo after the role check).
    const status = await getStripeSetupStatus();
    if (!status.canManagePayments) return { success: false, error: 'You need payment access to do this.' };
    const sudo = keystoneContext.sudo();
    const existing = await sudo.prisma.paymentProvider.findUnique({ where: { code: 'pp_stripe' } });
    if (existing) await sudo.prisma.paymentProvider.update({ where: { id: existing.id }, data: { isInstalled: true } });
    else await sudo.prisma.paymentProvider.create({ data: { name: 'Stripe', code: 'pp_stripe', adapter: 'stripe', isInstalled: true, isDefault: false } });
  } else if (!provider.isInstalled) {
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
