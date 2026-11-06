import Stripe from "stripe";
import type { CheckoutObservation, PaymentAdapter, PaymentAdapterStatus } from "./types";

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

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const id = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : value?.id ?? null);

export const stripePaymentAdapter: PaymentAdapter = {
  /** Hosted Stripe Checkout. Card data never reaches this server. */
  async createCheckout({ amount, currency, idempotencyKey, description, successUrl, cancelUrl, customerEmail, metadata, expiresInMinutes }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Payment amount must be a positive whole number of cents");
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        line_items: [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: amount, product_data: { name: description } } }],
        metadata,
        payment_intent_data: { metadata },
        ...(expiresInMinutes ? { expires_at: Math.floor(Date.now() / 1000) + Math.min(1440, Math.max(30, expiresInMinutes)) * 60 } : {}),
      },
      { idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe did not open a checkout");
    return {
      status: "pending",
      providerReference: session.id,
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    };
  },
  /** Reads the Checkout back from Stripe, including refunds made outside the app (charge.amount_refunded). */
  async retrieveCheckout({ providerReference }) {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(providerReference);
    const paymentIntentId = id(session.payment_intent);
    let refundedAmount = 0;
    if (paymentIntentId) {
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 20 });
      refundedAmount = charges.data.reduce((sum, charge) => sum + (charge.amount_refunded || 0), 0);
    }
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const observation: CheckoutObservation = {
      status: paid ? "completed" : session.status === "expired" ? "cancelled" : "pending",
      providerReference: session.id,
      paymentIntentId,
      amount: session.amount_total,
      currency: session.currency,
      refundedAmount,
    };
    return observation;
  },
  async expireCheckout({ providerReference }) {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(providerReference);
    if (session.status === "open") await stripe.checkout.sessions.expire(providerReference);
  },
  async createSubscriptionCheckout({ amount, currency, interval, idempotencyKey, description, successUrl, cancelUrl, customerEmail, metadata }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Price must be a positive whole number of cents");
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        line_items: [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: amount, recurring: { interval }, product_data: { name: description } } }],
        allow_promotion_codes: false,
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe did not open a checkout");
    return { status: "pending", providerReference: session.id, url: session.url, expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null };
  },
  async retrieveSubscriptionCheckout({ providerReference }) {
    const session = await stripeClient().checkout.sessions.retrieve(providerReference, { expand: ["subscription"] });
    const subscription = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
    const periodEnd = subscription?.items?.data?.[0]?.current_period_end;
    const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    return {
      status: paid ? "completed" : session.status === "expired" ? "cancelled" : "pending",
      providerReference: session.id,
      subscriptionId: id(session.subscription),
      amount: session.amount_total,
      currency: session.currency,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    };
  },
  async cancelSubscription({ subscriptionId }) {
    await stripeClient().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  },
  async setSubscriptionPaused({ subscriptionId, paused }) {
    await stripeClient().subscriptions.update(subscriptionId, { pause_collection: paused ? { behavior: "void" } : null } as any);
  },
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
    if (event.type === "invoice.paid") {
      // Membership renewals: later months are billed by Stripe, the salon records each paid invoice.
      const invoice = event.data.object as Stripe.Invoice;
      const parent = (invoice as any).parent?.subscription_details;
      const subscriptionId = typeof parent?.subscription === "string" ? parent.subscription : parent?.subscription?.id || null;
      const line = invoice.lines?.data?.[0];
      return {
        isValid: true, eventId: event.id, type: event.type, providerReference: null, status: null,
        amount: invoice.amount_paid, currency: invoice.currency,
        data: {
          livemode: event.livemode, kind: "subscription_invoice", invoiceId: invoice.id, subscriptionId,
          billingReason: invoice.billing_reason, periodEnd: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
        },
      };
    }
    const resource = event.data.object as Stripe.PaymentIntent | Stripe.Refund | Stripe.Charge | Stripe.Checkout.Session;
    if (resource.object === "checkout.session") {
      const paid = resource.payment_status === "paid" || resource.payment_status === "no_payment_required";
      const status: PaymentAdapterStatus | null =
        event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
          ? (paid ? "completed" : null)
          : event.type === "checkout.session.async_payment_failed" ? "failed"
          : event.type === "checkout.session.expired" ? "cancelled" : null;
      return {
        isValid: true,
        eventId: event.id,
        type: event.type,
        providerReference: resource.id,
        status,
        amount: resource.amount_total ?? undefined,
        currency: resource.currency ?? undefined,
        data: { livemode: event.livemode, checkoutSessionId: resource.id, paymentIntent: id(resource.payment_intent), sessionKey: resource.metadata?.depositKey || null },
      };
    }
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
      data: { livemode: event.livemode, sessionKey: ("metadata" in resource && resource.metadata?.depositKey) || null },
    };
  },
};
