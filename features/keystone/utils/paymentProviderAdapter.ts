import {
  getPaymentAdapter,
  type CreateCheckoutInput,
  type CreatePaymentSessionInput,
  type PaymentOperationInput,
  type PaymentProviderConfig,
  type PaymentWebhookInput,
  type SubscriptionCheckoutInput,
} from "../../integrations/payment";

export async function createProviderPaymentSession(input: CreatePaymentSessionInput) {
  return (await getPaymentAdapter(input.provider)).createSession(input);
}

export async function createProviderCheckout(input: CreateCheckoutInput) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.createCheckout) throw new Error("Provider does not take online payments");
  return adapter.createCheckout(input);
}

export async function retrieveProviderCheckout(input: { provider: PaymentProviderConfig; providerReference: string }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.retrieveCheckout) throw new Error("Provider does not take online payments");
  return adapter.retrieveCheckout(input);
}

export async function expireProviderCheckout(input: { provider: PaymentProviderConfig; providerReference: string }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.expireCheckout) throw new Error("Provider does not take online payments");
  return adapter.expireCheckout(input);
}

export async function createProviderSubscriptionCheckout(input: SubscriptionCheckoutInput) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.createSubscriptionCheckout) throw new Error("Provider does not take subscriptions");
  return adapter.createSubscriptionCheckout(input);
}

export async function retrieveProviderSubscriptionCheckout(input: { provider: PaymentProviderConfig; providerReference: string }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.retrieveSubscriptionCheckout) throw new Error("Provider does not take subscriptions");
  return adapter.retrieveSubscriptionCheckout(input);
}

export async function cancelProviderSubscription(input: { provider: PaymentProviderConfig; subscriptionId: string }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.cancelSubscription) throw new Error("Provider does not take subscriptions");
  return adapter.cancelSubscription(input);
}

export async function cancelProviderSubscriptionAndRefund(input: { provider: PaymentProviderConfig; subscriptionId: string; idempotencyKey: string }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.cancelSubscriptionAndRefund) throw new Error("Provider does not take subscriptions");
  return adapter.cancelSubscriptionAndRefund(input);
}

export async function setProviderSubscriptionPaused(input: { provider: PaymentProviderConfig; subscriptionId: string; paused: boolean }) {
  const adapter = await getPaymentAdapter(input.provider);
  if (!adapter.setSubscriptionPaused) throw new Error("Provider does not take subscriptions");
  return adapter.setSubscriptionPaused(input);
}

export async function confirmProviderPayment(input: PaymentOperationInput) {
  return (await getPaymentAdapter(input.provider)).confirm(input);
}

export async function refundProviderPayment(input: PaymentOperationInput) {
  return (await getPaymentAdapter(input.provider)).refund(input);
}

export async function parseProviderWebhook(input: PaymentWebhookInput) {
  return (await getPaymentAdapter(input.provider)).parseWebhook(input);
}

export function paymentProviderFromRecord(record: {
  code: string;
  adapter: string;
  config?: unknown;
}): PaymentProviderConfig {
  if (record.adapter !== "manual" && record.adapter !== "stripe") {
    throw new Error(`Unsupported payment adapter: ${record.adapter}`);
  }
  return {
    code: record.code,
    adapter: record.adapter,
    config: record.config && typeof record.config === "object" ? record.config as Record<string, unknown> : {},
  };
}
