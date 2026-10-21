import Stripe from "stripe";
import type { PaymentAdapter, PaymentAdapterStatus } from "./types";

function stripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured");
  return new Stripe(secretKey);
}

function mapStatus(status: Stripe.PaymentIntent.Status): PaymentAdapterStatus {
  if (status === "succeeded") return "completed";
  if (status === "requires_action" || status === "requires_payment_method" || status === "requires_confirmation") return "requires_action";
  if (status === "processing") return "authorized";
  if (status === "canceled") return "cancelled";
  return "pending";
}

export const stripePaymentAdapter: PaymentAdapter = {
  async createSession({ amount, currency, idempotencyKey, metadata }) {
    const intent = await stripeClient().paymentIntents.create(
      {
        amount,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      { idempotencyKey },
    );
    return {
      status: mapStatus(intent.status),
      providerReference: intent.id,
      clientSecret: intent.client_secret,
      data: { status: intent.status },
    };
  },
  async confirm({ providerReference }) {
    const intent = await stripeClient().paymentIntents.retrieve(providerReference);
    return {
      status: mapStatus(intent.status),
      providerReference,
      amount: intent.amount_received,
      data: { status: intent.status },
    };
  },
  async refund({ providerReference, amount, idempotencyKey, refundId }) {
    const refund = refundId ? await stripeClient().refunds.retrieve(refundId) : await stripeClient().refunds.create(
      { payment_intent: providerReference, ...(amount ? { amount } : {}) },
      { idempotencyKey },
    );
    return {
      status: refund.status === "succeeded" ? "refunded" : ["failed", "canceled"].includes(refund.status || "") ? "failed" : "pending",
      providerReference,
      amount: refund.amount,
      data: { refundId: refund.id, status: refund.status },
    };
  },
  async parseWebhook({ payload, headers }) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = headers["stripe-signature"];
    if (!secret || !signature) throw new Error("Stripe webhook verification is not configured");
    const event = stripeClient().webhooks.constructEvent(payload, signature, secret);
    const resource = event.data.object as Stripe.PaymentIntent | Stripe.Refund | Stripe.Charge;
    const paymentIntent = "payment_intent" in resource ? resource.payment_intent : null;
    const providerReference = paymentIntent
      ? typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id
      : resource.object === "payment_intent" ? resource.id : null;
    let amount = resource.object === "payment_intent"
      ? resource.amount_received || resource.amount
      : resource.object === "charge"
        ? resource.amount_refunded
        : resource.amount;
    let status: PaymentAdapterStatus | null = event.type === "payment_intent.succeeded"
      ? "completed"
      : event.type === "payment_intent.payment_failed"
        ? "requires_action"
        : event.type === "payment_intent.canceled"
          ? "cancelled"
          : event.type === "charge.refunded" ? "refunded" : null;
    if (event.type === "refund.updated" && resource.object === "refund" && resource.status === "succeeded") {
      const chargeId = typeof resource.charge === "string" ? resource.charge : resource.charge?.id;
      if (chargeId) {
        const charge = await stripeClient().charges.retrieve(chargeId);
        amount = charge.amount_refunded;
        status = "refunded";
      }
    }
    return {
      isValid: true,
      eventId: event.id,
      type: event.type,
      providerReference,
      status,
      amount,
      currency: resource.currency,
      data: { livemode: event.livemode },
    };
  },
};
