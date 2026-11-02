// Appointment page "Refund deposit": which deposit is refundable, the confirm/feedback text,
// the refund state shown afterwards, and the Checkout → PaymentIntent reference the provider
// refund targets. Node's built-in runner; modules are transpiled in memory. No DB, network or processor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const source = fs.readFileSync(path.resolve(root, relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (id) => (id.startsWith('node:') ? require(id) : new Proxy({}, { get: () => () => null })) });
  return module.exports;
}

const lib = load('features/platform/appointments/lib/depositRefund.ts');
const { depositRefundReference } = load('features/keystone/mutations/depositRefund.ts');
const card = (over = {}) => ({ id: 's1', amount: 5000, data: { purpose: 'appointment_deposit', checkout: true }, provider: { adapter: 'stripe' }, payment: { status: 'completed', refundedAmount: 0 }, ...over });

test('only a paid online card deposit with money left is refundable here', () => {
  assert.equal(lib.refundableDeposit(null, { hasCheckout: false }), null);
  assert.equal(lib.refundableDeposit([card({ payment: { status: 'pending' } })], { hasCheckout: false }), null, 'unpaid checkout');
  assert.equal(lib.refundableDeposit([card({ provider: { adapter: 'manual' } })], { hasCheckout: false }), null, 'desk cash/terminal deposits are handed back by the salon');
  assert.equal(lib.refundableDeposit([card({ data: { purpose: 'checkout' } })], { hasCheckout: false }), null, 'not a deposit');
  assert.equal(lib.refundableDeposit([card({ payment: { status: 'refunded', refundedAmount: 5000 } })], { hasCheckout: false }), null);
  assert.equal(lib.refundableDeposit([card()], { hasCheckout: true }), null, 'after checkout the sale reversal owns the refund');
  assert.deepEqual({ ...lib.refundableDeposit([card()], { hasCheckout: false }) }, { id: 's1', remaining: 5000 });
  assert.deepEqual({ ...lib.refundableDeposit([card({ payment: { status: 'partially_refunded', refundedAmount: 2000 } })], { hasCheckout: false }) }, { id: 's1', remaining: 3000 });
});

test('refund state appears only after money went back', () => {
  assert.equal(lib.depositRefundState([card()]), null);
  assert.deepEqual({ ...lib.depositRefundState([card({ payment: { status: 'refunded', refundedAmount: 5000 } })]) }, { tone: 'refunded', refunded: 5000 });
  assert.deepEqual({ ...lib.depositRefundState([card({ payment: { status: 'partially_refunded', refundedAmount: 2000 } })]) }, { tone: 'partial', refunded: 2000 });
});

test('feedback reports the verified refund and passes errors through', () => {
  assert.equal(lib.depositRefundFeedback({ success: false, error: 'You must have refund authority' }, '$50.00'), 'You must have refund authority');
  assert.equal(lib.depositRefundFeedback({ success: true, status: 'refunded' }, '$50.00'), 'Deposit refunded: $50.00 back to the card.');
  assert.match(lib.depositRefundFeedback({ success: true, status: 'pending' }, '$50.00'), /not refunded yet/);
});

test('a Checkout deposit is refunded on its PaymentIntent, never the Checkout id', () => {
  assert.equal(depositRefundReference({ providerReference: 'cs_test_1', data: { paymentIntent: 'pi_123' } }), 'pi_123');
  assert.equal(depositRefundReference({ providerReference: 'cs_test_1', data: {} }), null, 'not read back yet: refuse rather than send cs_ to Stripe');
  assert.equal(depositRefundReference({ providerReference: 'manual_abc', data: {} }), 'manual_abc');
});

test('wiring: confirm dialog, existing refund mutation, refund-permission gate', () => {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const button = read('features/platform/appointments/components/RefundDepositButton.tsx');
  assert.match(button, /AlertDialogTrigger[\s\S]*Refund deposit/);
  assert.match(button, /<AlertDialogAction onClick=\{confirm\}>/, 'refund runs only from the confirm action');
  const action = read('features/platform/appointments/actions/depositRefund.ts');
  assert.match(action, /refundPayment\(paymentSessionId: \$id, idempotencyKey: \$key, reason: \$reason\)/);
  const detail = read('features/platform/appointments/actions/appointmentDetail.ts');
  assert.match(detail, /refunds: manager \|\| role\?\.canIssueRefunds === true/);
  assert.match(detail, /capabilities\.refunds && Number\(appointment\.depositAmount/);
  assert.doesNotMatch(detail, /,\s*,/, 'no array holes in the Promise.all that would shift depositSessions');
  const page = read('features/platform/appointments/screens/AppointmentDetailPage.tsx');
  assert.match(page, /capabilities\.refunds \? refundableDeposit\(depositSessions/);
  const workflow = read('features/keystone/mutations/depositRefund.ts');
  assert.match(workflow, /refundProviderPayment\(\{[^}]*providerReference,/, 'the provider refund uses the resolved PaymentIntent');
});
