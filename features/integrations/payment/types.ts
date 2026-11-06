export type PaymentAdapterStatus =
  | "pending"
  | "requires_action"
  | "authorized"
  | "completed"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded";

export interface PaymentProviderConfig {
  code: string;
  adapter: "manual" | "stripe";
  config?: Record<string, unknown> | null;
}

export interface CreatePaymentSessionInput {
  provider: PaymentProviderConfig;
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface PaymentSessionResult {
  status: PaymentAdapterStatus;
  providerReference: string;
  clientSecret?: string | null;
  data?: Record<string, unknown>;
}

export interface PaymentOperationInput {
  refundId?: string;
  provider: PaymentProviderConfig;
  providerReference: string;
  amount?: number;
  idempotencyKey: string;
}

export interface PaymentOperationResult {
  status: PaymentAdapterStatus;
  providerReference: string;
  amount?: number;
  data?: Record<string, unknown>;
}

export interface PaymentWebhookInput {
  provider: PaymentProviderConfig;
  payload: string;
  headers: Record<string, string | undefined>;
}

export interface PaymentWebhookResult {
  isValid: boolean;
  eventId: string;
  type: string;
  providerReference: string | null;
  status: PaymentAdapterStatus | null;
  amount?: number;
  currency?: string;
  data?: Record<string, unknown>;
}

export interface CreateCheckoutInput {
  provider: PaymentProviderConfig;
  amount: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
  /** Close the hosted page after this many minutes (Stripe allows 30 to 1440). */
  expiresInMinutes?: number;
}

export interface CheckoutResult {
  status: PaymentAdapterStatus;
  /** The provider's hosted-checkout id (Stripe `cs_…`). */
  providerReference: string;
  url: string;
  expiresAt: string | null;
}

/** What the provider reports for a hosted checkout, read straight from the provider. */
export interface CheckoutObservation {
  status: "pending" | "completed" | "cancelled";
  providerReference: string;
  paymentIntentId: string | null;
  amount: number | null;
  currency: string | null;
  /** Total refunded across every charge of the payment, in minor units. */
  refundedAmount: number;
}

export interface SubscriptionCheckoutInput {
  provider: PaymentProviderConfig;
  /** Recurring price per interval, in minor units. */
  amount: number;
  currency: string;
  interval: "month";
  idempotencyKey: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  metadata: Record<string, string>;
}

export interface SubscriptionObservation {
  status: "pending" | "completed" | "cancelled";
  providerReference: string;
  subscriptionId: string | null;
  amount: number | null;
  currency: string | null;
  /** End of the paid period, ISO. */
  currentPeriodEnd: string | null;
}

export interface PaymentAdapter {
  /** Hosted checkout for online payments. Adapters that cannot take online payments leave these undefined. */
  createCheckout?(input: CreateCheckoutInput): Promise<CheckoutResult>;
  retrieveCheckout?(input: { provider: PaymentProviderConfig; providerReference: string }): Promise<CheckoutObservation>;
  /** Closes an unpaid hosted checkout so it can no longer be paid. */
  expireCheckout?(input: { provider: PaymentProviderConfig; providerReference: string }): Promise<void>;
  /** Hosted checkout that starts a recurring subscription (memberships). */
  createSubscriptionCheckout?(input: SubscriptionCheckoutInput): Promise<CheckoutResult>;
  retrieveSubscriptionCheckout?(input: { provider: PaymentProviderConfig; providerReference: string }): Promise<SubscriptionObservation>;
  /** Stops renewing at the end of the paid period. */
  cancelSubscription?(input: { provider: PaymentProviderConfig; subscriptionId: string }): Promise<void>;
  /** Ends the subscription now and refunds its latest paid invoice (Mindbody/Square "cancel and refund"). */
  cancelSubscriptionAndRefund?(input: { provider: PaymentProviderConfig; subscriptionId: string; idempotencyKey: string }): Promise<{ refundId: string | null; amount: number }>;
  /** Pause (skip invoices) or resume billing. */
  setSubscriptionPaused?(input: { provider: PaymentProviderConfig; subscriptionId: string; paused: boolean }): Promise<void>;
  createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>;
  confirm(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  refund(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookResult>;
}
