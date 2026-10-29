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

export interface PaymentAdapter {
  /** Hosted checkout for online payments. Adapters that cannot take online payments leave these undefined. */
  createCheckout?(input: CreateCheckoutInput): Promise<CheckoutResult>;
  retrieveCheckout?(input: { provider: PaymentProviderConfig; providerReference: string }): Promise<CheckoutObservation>;
  createSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult>;
  confirm(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  refund(input: PaymentOperationInput): Promise<PaymentOperationResult>;
  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookResult>;
}
