// "Set up Stripe": staff with payment authority may switch an existing provider on;
// nothing else about providers is writable from the dashboard.
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

const { providerUpdateProblem } = load('features/keystone/utils/paymentProviderActivation.ts');
const stripe = { adapter: 'stripe', isDefault: false, isInstalled: false };
const manual = { adapter: 'manual', isDefault: true, isInstalled: true };

test('switching Stripe on is allowed once the server has a Stripe key', () => {
  assert.equal(providerUpdateProblem({ inputData: { isInstalled: true }, item: stripe, stripeKeyConfigured: true }), null);
  assert.match(providerUpdateProblem({ inputData: { isInstalled: true }, item: stripe, stripeKeyConfigured: false }), /STRIPE_SECRET_KEY/);
});

test('only isInstalled is writable: adapter, code, config, name and default are refused', () => {
  for (const field of ['adapter', 'code', 'config', 'name', 'isDefault']) {
    const problem = providerUpdateProblem({ inputData: { isInstalled: true, [field]: 'x' }, item: stripe, stripeKeyConfigured: true });
    assert.match(problem, new RegExp(`Only isInstalled.*${field}`));
  }
});

test('the default in-salon provider cannot be switched off; Stripe can', () => {
  assert.match(providerUpdateProblem({ inputData: { isInstalled: false }, item: manual, stripeKeyConfigured: true }), /default provider/);
  assert.equal(providerUpdateProblem({ inputData: { isInstalled: false }, item: { ...stripe, isInstalled: true }, stripeKeyConfigured: true }), null);
});

test('model: update only for canManagePayments, create and delete closed, other fields code-owned', () => {
  const model = read('features/keystone/models/PaymentProvider.ts');
  assert.match(model, /create: \(\) => false,\s*update: permissions\.canManagePayments,\s*delete: \(\) => false/);
  assert.match(model, /validateInput[\s\S]*providerUpdateProblem/);
  for (const field of ['name', 'code', 'adapter', 'isDefault', 'config']) {
    assert.match(model, new RegExp(`${field}: \\w+\\(\\{[^]*?access: codeOwned`), `${field} is code-owned`);
  }
  assert.match(model, /isInstalled: checkbox\(\{ defaultValue: false \}\)/);
});

test('dashboard: Set up Stripe writes isInstalled only, behind a confirm and the payment permission', () => {
  const action = read('features/platform/workspaces/actions/paymentProviders.ts');
  assert.match(action, /updatePaymentProvider\(where: \{ id: \$id \}, data: \{ isInstalled: true \}\)/);
  assert.doesNotMatch(action, /createPaymentProvider|deletePaymentProvider/);
  assert.match(read('features/platform/workspaces/components/SetUpStripe.tsx'), /AlertDialogAction onClick=\{confirm\}/);
  assert.match(read('features/platform/workspaces/screens/SalonWorkspacePage.tsx'), /stripeSetup\?\.canManagePayments[\s\S]*<SetUpStripe \/>/);
});
