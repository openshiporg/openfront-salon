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
  assert.match(detail, /\(capabilities\.refunds \|\| capabilities\.payments\) && Number\(appointment\.depositAmount/, 'refund or payment staff load deposit sessions; the refund button stays gated on refunds');
  assert.doesNotMatch(detail, /,\s*,/, 'no array holes in the Promise.all that would shift depositSessions');
  const page = read('features/platform/appointments/screens/AppointmentDetailPage.tsx');
  assert.match(page, /capabilities\.refunds \? refundableDeposit\(depositSessions/);
  const workflow = read('features/keystone/mutations/depositRefund.ts');
  assert.match(workflow, /refundProviderPayment\(\{[^}]*providerReference,/, 'the provider refund uses the resolved PaymentIntent');
});

test('"Check payment with Stripe" targets only an open online card checkout', () => {
  const open = (over = {}) => card({ status: 'pending', providerReference: 'cs_test_1', payment: { status: 'pending', refundedAmount: 0 }, ...over });
  assert.equal(lib.pendingOnlineDeposit(null), null);
  assert.deepEqual({ ...lib.pendingOnlineDeposit([open()]) }, { id: 's1' });
  assert.deepEqual({ ...lib.pendingOnlineDeposit([open({ status: 'requires_action' })]) }, { id: 's1' });
  assert.equal(lib.pendingOnlineDeposit([open({ status: 'completed' })]), null, 'already paid');
  assert.equal(lib.pendingOnlineDeposit([open({ status: 'failed' })]), null);
  assert.equal(lib.pendingOnlineDeposit([open({ provider: { adapter: 'manual' } })]), null, 'desk deposits have nothing to check');
  assert.equal(lib.pendingOnlineDeposit([open({ providerReference: null })]), null, 'checkout never opened');
  assert.equal(lib.pendingOnlineDeposit([open({ data: { purpose: 'appointment_deposit' } })]), null, 'not a hosted checkout');
});

test('Stripe check feedback says what Stripe reported', () => {
  assert.deepEqual({ ...lib.depositCheckFeedback({ success: true, status: 'completed' }, '$50.00') }, { ok: true, text: 'Stripe shows the $50.00 deposit paid. Marked paid.' });
  assert.match(lib.depositCheckFeedback({ success: true, status: 'pending' }, '$50.00').text, /no payment yet/);
  assert.match(lib.depositCheckFeedback({ success: true, status: 'cancelled' }, '$50.00').text, /expired unpaid/);
  assert.match(lib.depositCheckFeedback({ success: true, status: 'refunded' }, '$50.00').text, /refunded/);
  assert.deepEqual({ ...lib.depositCheckFeedback({ success: false, error: 'You must have payment authority' }, '$50.00') }, { ok: false, text: 'You must have payment authority' });
});

test('the button calls confirmPayment and shows only while the deposit is unpaid', () => {
  const action = fs.readFileSync(path.join(root, 'features/platform/appointments/actions/depositCheck.ts'), 'utf8');
  assert.match(action, /confirmPayment\(paymentSessionId: \$id\) \{ success error status \}/);
  const page = fs.readFileSync(path.join(root, 'features/platform/appointments/screens/AppointmentDetailPage.tsx'), 'utf8');
  assert.match(page, /capabilities\.payments && !appointment\.depositPaid \? pendingOnlineDeposit\(depositSessions\)/);
  assert.match(page, /<CheckDepositButton paymentSessionId=\{openOnlineDeposit\.id\}/);
  assert.match(fs.readFileSync(path.join(root, 'features/platform/appointments/components/CheckDepositButton.tsx'), 'utf8'), /Check payment with Stripe/);
});

test('Cancel appointment asks first with an AlertDialog on both the detail page and the queue', () => {
  const src = fs.readFileSync(path.join(root, 'features/platform/appointments/screens/AppointmentActions.tsx'), 'utf8');
  assert.match(src, /from '@\/components\/ui\/alert-dialog'/);
  assert.match(src, /AlertDialogTitle>Cancel this appointment\?/);
  assert.match(src, /AlertDialogCancel>Keep appointment/);
  // cancel() only ever runs from the dialog's action.
  assert.equal((src.match(/void cancel\(\)/g) || []).length, 2);
  assert.equal((src.match(/<ConfirmCancel label=\{label\} onConfirm=\{\(\) => void cancel\(\)\}>/g) || []).length, 2);
});

test('the cancel confirm does not promise a client message the app never sends', () => {
  const src = fs.readFileSync(path.join(root, 'features/platform/appointments/screens/AppointmentActions.tsx'), 'utf8');
  const mail = fs.readFileSync(path.join(root, 'features/keystone/lib/mail.ts'), 'utf8');
  if (!/cancel/i.test(mail)) assert.match(src, /No message goes to the client/);
});
