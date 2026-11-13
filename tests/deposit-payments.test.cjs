// Online deposit settlement: amount/currency assertions, refunds made outside the app, the booking token,
// and the Stripe adapter's Checkout read-back and webhook parsing (Stripe SDK stubbed; no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, stubs = {}) {
  const cache = new Map();
  function run(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (specifier) => {
      if (specifier in stubs) return stubs[specifier];
      if (specifier.startsWith('node:')) return require(specifier);
      const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(filename), specifier) : null;
      if (resolved && fs.existsSync(`${resolved}.ts`)) return run(`${resolved}.ts`);
      return new Proxy({}, { get: () => () => null });
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, process: { env: stubs.__env || {} }, console, URL, Date, Math, Number, Buffer }, { filename });
    return module.exports;
  }
  return run(path.resolve(root, relative));
}

const { planCheckoutSettlement, applyObservation, tokenMatches, depositAccessToken } = load('features/keystone/depositCheckout.ts');
const pending = { status: 'pending', amount: 5000, currency: 'usd', refundedAmount: 0 };
const paid = (over = {}) => ({ status: 'completed', amount: 5000, currency: 'usd', refundedAmount: 0, ...over });

test('a paid checkout completes a pending deposit', () => {
  const plan = planCheckoutSettlement(pending, paid());
  assert.equal(plan.status, 'completed');
  assert.equal(plan.changed, true);
});

test('an unpaid checkout changes nothing', () => {
  const plan = planCheckoutSettlement(pending, { status: 'pending', amount: null, currency: null, refundedAmount: 0 });
  assert.equal(plan.changed, false);
  assert.equal(plan.status, 'pending');
});

test('an amount that differs from the deposit is refused', () => {
  assert.throws(() => planCheckoutSettlement(pending, paid({ amount: 4999 })), /amount paid does not match/);
  assert.throws(() => planCheckoutSettlement(pending, paid({ amount: null })), /amount paid does not match/);
});

test('a currency that differs from the deposit is refused', () => {
  assert.throws(() => planCheckoutSettlement(pending, paid({ currency: 'eur' })), /currency paid does not match/);
  assert.equal(planCheckoutSettlement(pending, paid({ currency: 'USD' })).status, 'completed');
});

test('a refund made in the Stripe dashboard is observed through amount_refunded', () => {
  const partial = planCheckoutSettlement(pending, paid({ refundedAmount: 2000 }));
  assert.equal(partial.status, 'partially_refunded');
  assert.equal(partial.refundedAmount, 2000);
  const full = planCheckoutSettlement({ ...pending, status: 'completed' }, paid({ refundedAmount: 5000 }));
  assert.equal(full.status, 'refunded');
  assert.equal(full.refundedAmount, 5000);
  const later = planCheckoutSettlement({ status: 'partially_refunded', amount: 5000, currency: 'usd', refundedAmount: 2000 }, paid({ refundedAmount: 5000 }));
  assert.equal(later.status, 'refunded');
});

test('a refund total never goes backwards or beyond the deposit', () => {
  const plan = planCheckoutSettlement({ status: 'partially_refunded', amount: 5000, currency: 'usd', refundedAmount: 3000 }, paid({ refundedAmount: 1000 }));
  assert.equal(plan.refundedAmount, 3000);
  assert.equal(plan.changed, false);
  assert.equal(planCheckoutSettlement({ ...pending, status: 'completed' }, paid({ refundedAmount: 9999 })).refundedAmount, 5000);
});

test('replaying the same observation is a no-op', () => {
  const first = planCheckoutSettlement(pending, paid({ refundedAmount: 2000 }));
  const again = planCheckoutSettlement({ status: first.status, amount: 5000, currency: 'usd', refundedAmount: first.refundedAmount }, paid({ refundedAmount: 2000 }));
  assert.equal(again.changed, false);
});

test('an expired checkout cancels the open deposit but never erases a captured one', () => {
  const expired = { status: 'cancelled', amount: null, currency: null, refundedAmount: 0 };
  assert.equal(planCheckoutSettlement(pending, expired).status, 'cancelled');
  const captured = planCheckoutSettlement({ ...pending, status: 'completed' }, expired);
  assert.equal(captured.status, 'completed');
  assert.equal(captured.changed, false);
});

test('a paid deposit puts the Stripe PaymentIntent on its Payment row once', async () => {
  const writes = [];
  const sudo = { query: new Proxy({}, { get: (_t, list) => ({ updateOne: async (args) => { writes.push({ list, ...args }); return { id: 'x' }; } }) }) };
  const session = { id: 's1', status: 'pending', amount: 5000, currency: 'usd', data: { purpose: 'appointment_deposit' }, payment: { id: 'p1', status: 'pending', refundedAmount: 0, stripePaymentIntentId: '' }, appointment: { id: 'a1', status: 'pending', transaction: null } };
  await applyObservation(sudo, session, { status: 'completed', providerReference: 'cs_test_1', paymentIntentId: 'pi_123', amount: 5000, currency: 'usd', refundedAmount: 0 });
  assert.equal(writes.find((write) => write.list === 'Payment').data.stripePaymentIntentId, 'pi_123');
  writes.length = 0;
  await applyObservation(sudo, { ...session, status: 'completed', payment: { ...session.payment, status: 'completed', stripePaymentIntentId: 'pi_123' } }, { status: 'completed', providerReference: 'cs_test_1', paymentIntentId: 'pi_123', amount: 5000, currency: 'usd', refundedAmount: 5000 });
  assert.equal('stripePaymentIntentId' in writes.find((write) => write.list === 'Payment').data, false, 'never rewritten');
});

test('the booking access token is bound to one appointment and one secret', () => {
  const secret = 'x'.repeat(40);
  const token = depositAccessToken('appt_1', secret);
  assert.equal(tokenMatches('appt_1', token, secret), true);
  assert.equal(tokenMatches('appt_2', token, secret), false);
  assert.equal(tokenMatches('appt_1', token, 'y'.repeat(40)), false);
  assert.equal(tokenMatches('appt_1', '', secret), false);
  assert.equal(tokenMatches('appt_1', token.slice(1), secret), false);
  assert.throws(() => depositAccessToken('appt_1', 'short'), /SESSION_SECRET/);
});

function stripeStub(calls) {
  const state = { session: null, charges: [], event: null };
  class Stripe {
    constructor() {
      this.checkout = { sessions: { create: async (body, opts) => { calls.push({ body, opts }); return { id: 'cs_test_1', url: 'https://checkout.stripe.test/c/1', expires_at: 1900000000 }; }, retrieve: async () => state.session } };
      this.charges = { list: async () => ({ data: state.charges }) };
      this.webhooks = { constructEvent: () => state.event };
    }
  }
  return { Stripe, state };
}

function adapterWith(env = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }) {
  const calls = [];
  const { Stripe, state } = stripeStub(calls);
  const mod = load('features/integrations/payment/stripe.ts', { stripe: { __esModule: true, default: Stripe }, __env: env });
  return { adapter: mod.stripePaymentAdapter, state, calls };
}

test('createCheckout sends integer cents, the idempotency key and deposit metadata to Stripe', async () => {
  const { adapter, calls } = adapterWith();
  const result = await adapter.createCheckout({ provider: { code: 'pp_stripe', adapter: 'stripe' }, amount: 5000, currency: 'USD', idempotencyKey: 'deposit-1', description: 'Deposit · Cut', successUrl: 'https://x/ok', cancelUrl: 'https://x/no', metadata: { depositKey: 'deposit-1' } });
  assert.equal(result.providerReference, 'cs_test_1');
  assert.equal(calls[0].opts.idempotencyKey, 'deposit-1');
  assert.equal(calls[0].body.line_items[0].price_data.unit_amount, 5000);
  assert.equal(calls[0].body.line_items[0].price_data.currency, 'usd');
  await assert.rejects(() => adapter.createCheckout({ provider: {}, amount: 50.5, currency: 'usd', idempotencyKey: 'k', description: 'd', successUrl: 'a', cancelUrl: 'b', metadata: {} }), /positive whole number/);
});

test('retrieveCheckout sums amount_refunded across charges so outside refunds are seen', async () => {
  const { adapter, state } = adapterWith();
  state.session = { id: 'cs_test_1', payment_status: 'paid', status: 'complete', payment_intent: 'pi_1', amount_total: 5000, currency: 'usd' };
  state.charges = [{ amount_refunded: 1500 }, { amount_refunded: 500 }];
  const seen = await adapter.retrieveCheckout({ provider: {}, providerReference: 'cs_test_1' });
  assert.deepEqual({ ...seen }, { status: 'completed', providerReference: 'cs_test_1', paymentIntentId: 'pi_1', amount: 5000, currency: 'usd', refundedAmount: 2000 });
  state.session = { id: 'cs_test_1', payment_status: 'unpaid', status: 'expired', payment_intent: null, amount_total: 5000, currency: 'usd' };
  assert.equal((await adapter.retrieveCheckout({ provider: {}, providerReference: 'cs_test_1' })).status, 'cancelled');
});

test('webhook parsing reports checkout completion with amount and currency, and refunds from the charge', async () => {
  const { adapter, state } = adapterWith();
  const headers = { 'stripe-signature': 't=1,v1=x' };
  state.event = { id: 'evt_1', type: 'checkout.session.completed', livemode: false, data: { object: { object: 'checkout.session', id: 'cs_1', payment_status: 'paid', amount_total: 5000, currency: 'usd', payment_intent: 'pi_1', metadata: { depositKey: 'k1' } } } };
  const done = await adapter.parseWebhook({ provider: {}, payload: '{}', headers });
  assert.equal(done.status, 'completed');
  assert.equal(done.amount, 5000);
  assert.equal(done.currency, 'usd');
  assert.equal(done.providerReference, 'cs_1');
  state.event = { id: 'evt_2', type: 'checkout.session.completed', livemode: false, data: { object: { object: 'checkout.session', id: 'cs_1', payment_status: 'unpaid', amount_total: 5000, currency: 'usd', payment_intent: 'pi_1', metadata: {} } } };
  assert.equal((await adapter.parseWebhook({ provider: {}, payload: '{}', headers })).status, null);
  state.event = { id: 'evt_3', type: 'charge.refunded', livemode: false, data: { object: { object: 'charge', id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 2000, currency: 'usd' } } };
  const refunded = await adapter.parseWebhook({ provider: {}, payload: '{}', headers });
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.amount, 2000);
  assert.equal(refunded.providerReference, 'pi_1');
  await assert.rejects(() => adapter.parseWebhook({ provider: {}, payload: '{}', headers: {} }), /not configured/);
});

// The webhook handler against an in-memory Keystone context: durable dedupe, amount and currency assertions.
function webhookHarness(eventOverrides = {}) {
  const store = { events: [], session: { id: 's1', status: 'pending', amount: 5000, currency: 'usd', idempotencyKey: 'k', data: { purpose: 'appointment_deposit', checkout: true }, payment: { id: 'p1', status: 'pending', refundedAmount: 0 }, appointment: { id: 'a1', status: 'pending', transaction: null } }, writes: [] };
  const sudo = { query: {
    PaymentProvider: { findMany: async () => [{ id: 'prov', code: 'pp_stripe', adapter: 'stripe', config: {} }] },
    PaymentSession: { findMany: async () => [store.session], findOne: async () => store.session, updateOne: async ({ data }) => { store.writes.push(['session', data.status]); Object.assign(store.session, { status: data.status ?? store.session.status }); return {}; } },
    Payment: { updateOne: async ({ data }) => { store.writes.push(['payment', data.status]); return {}; } },
    Appointment: { updateOne: async ({ data }) => { store.writes.push(['appointment', data.depositPaid]); return {}; } },
    PaymentWebhookEvent: {
      findMany: async ({ where }) => store.events.filter((e) => e.replayKey === where.replayKey.equals),
      createOne: async ({ data }) => { store.events.push({ id: `e${store.events.length}`, ...data }); return {}; },
      updateOne: async () => ({}),
    },
  } };
  const tx = { prisma: { $executeRawUnsafe: async () => 1, paymentSession: { findFirst: async () => null } }, sudo: () => sudo };
  const context = { sudo: () => sudo, transaction: async (fn) => fn(tx) };
  const event = { isValid: true, eventId: 'evt_1', type: 'checkout.session.completed', providerReference: 'cs_1', status: 'completed', amount: 5000, currency: 'usd', data: { paymentIntent: 'pi_1' }, ...eventOverrides };
  const mod = load('features/keystone/payment-webhook.ts', { './utils/paymentProviderAdapter': { parseProviderWebhook: async () => event, paymentProviderFromRecord: (r) => r } });
  return { store, run: () => mod.reconcilePaymentWebhook(context, 'pp_stripe', '{"x":1}', {}) };
}

test('a Checkout completion webhook captures the deposit once and a duplicate delivery is a no-op', async () => {
  const { store, run } = webhookHarness();
  const first = await run();
  assert.deepEqual({ ...first }, { replayed: false, processed: true, status: 'processed' });
  assert.deepEqual(store.writes.map((w) => w.join(':')), ['session:completed', 'payment:completed', 'appointment:true']);
  const writes = store.writes.length;
  const second = await run();
  assert.equal(second.replayed, true);
  assert.equal(store.writes.length, writes);
  assert.equal(store.events.length, 1);
});

test('a webhook whose amount or currency differs from the deposit is rejected before any write', async () => {
  for (const override of [{ amount: 4999 }, { currency: 'eur' }, { amount: undefined }]) {
    const { store, run } = webhookHarness(override);
    await assert.rejects(run, /amount|currency/i);
    assert.equal(store.writes.length, 0);
    assert.equal(store.events.length, 0);
  }
});
