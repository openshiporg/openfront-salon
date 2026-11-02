// Appointment Payment panel rows and the phone assistant button placement.
// Node's built-in runner; modules transpiled in memory. No DB, network or browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load(relative) {
  const { outputText } = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, require });
  return module.exports;
}

const { paymentSessionRows } = load('features/platform/appointments/lib/paymentSessionRows.ts');
const deposit = (over = {}) => ({ id: 's1', status: 'completed', amount: 5000, createdAt: '2026-11-01T10:00:00Z', completedAt: '2026-11-01T10:05:00Z', data: { purpose: 'appointment_deposit' }, provider: { name: 'Stripe', adapter: 'stripe' }, payment: { id: 'p1', refundedAmount: 0 }, ...over });

test('a session renders as a payment row: status, purpose, provider, amount, date', () => {
  const [row] = paymentSessionRows([deposit()]);
  assert.deepEqual({ ...row }, { id: 's1', tone: 'emerald', status: 'Paid', purpose: 'Deposit', amount: 5000, refunded: 0, provider: 'Stripe', at: '2026-11-01T10:05:00Z' });
});

test('refunded and failed rows date from the change that defined them', () => {
  const [refunded] = paymentSessionRows([deposit({ status: 'refunded', refundedAt: '2026-11-02T00:34:23Z', payment: { id: 'p1', refundedAmount: 5000 } })]);
  assert.equal(refunded.status, 'Refunded'); assert.equal(refunded.refunded, 5000); assert.equal(refunded.at, '2026-11-02T00:34:23Z');
  const [failed] = paymentSessionRows([deposit({ status: 'failed', completedAt: null, failedAt: '2026-11-01T11:00:00Z' })]);
  assert.equal(failed.tone, 'rose'); assert.equal(failed.at, '2026-11-01T11:00:00Z');
});

test('nothing to show means no rows, and payments already listed are not repeated', () => {
  assert.equal(paymentSessionRows([]).length, 0);
  assert.equal(paymentSessionRows(null).length, 0);
  assert.equal(paymentSessionRows([deposit()], ['p1']).length, 0);
});

test('the panel no longer prints the provider-settings tip', () => {
  const page = read('features/platform/appointments/screens/AppointmentDetailPage.tsx');
  assert.doesNotMatch(page, /payment session\{|Provider settings live in Integrations/);
  assert.match(page, /paymentSessionRows\(boundary\.sessions/);
});

test('phones: the header carries the assistant button and the floating one hides', () => {
  assert.match(read('features/dashboard/components/PageBreadcrumbs.tsx'), /<AssistantHeaderButton \/>/);
  assert.match(read('features/dashboard/components/AssistantHeaderButton.tsx'), /data-assistant-header=""[\s\S]*md:hidden/);
  assert.match(read('features/dashboard/components/DashboardLayout.tsx'), /data-assistant-floating=""/);
  assert.match(read('app/dashboard/globals.css'), /body:has\(\[data-assistant-header\]\) \[data-assistant-floating\]\s*\{\s*display: none;/);
});
