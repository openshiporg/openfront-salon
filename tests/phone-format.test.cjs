// One phone formatter for every place salon shows a phone number.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const { outputText } = ts.transpileModule(read('features/lib/phone.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const module_ = { exports: {} };
vm.runInNewContext(outputText, { module: module_, exports: module_.exports });
const { formatPhone, phoneHref } = module_.exports;

test('ten-digit and +1 numbers read as (555) 010-0299', () => {
  for (const raw of ['5550100299', '555-010-0299', '(555) 010-0299', '+1 555 010 0299', '15550100299', ' 555.010.0299 ']) {
    assert.equal(formatPhone(raw), '(555) 010-0299', raw);
  }
});

test('other numbers are left as entered; empty stays empty', () => {
  assert.equal(formatPhone('+44 20 7946 0958'), '+44 20 7946 0958');
  assert.equal(formatPhone('555-0100'), '555-0100');
  assert.equal(formatPhone('555 010 0299 ext 4'), '555 010 0299 ext 4');
  assert.equal(formatPhone(''), '');
  assert.equal(formatPhone(null), '');
});

test('tel: links dial digits only, keeping a leading +', () => {
  assert.equal(phoneHref('(555) 010-0299'), 'tel:5550100299');
  assert.equal(phoneHref('+44 20 7946 0958'), 'tel:+442079460958');
  assert.equal(phoneHref(''), null);
});

test('every screen that shows a phone formats it through the one helper', () => {
  const screens = [
    'features/platform/clients/screens/ClientDirectory.tsx', 'features/platform/clients/screens/ClientProfilePage.tsx',
    'features/platform/appointments/screens/AppointmentDetailPage.tsx', 'features/platform/appointments/screens/StaffBookingForm.tsx',
    'features/platform/waitlist/screens/WaitlistClient.tsx', 'features/platform/workspaces/screens/SalonRecordManager.tsx',
    'features/platform/staff/screens/StaffProfilePage.tsx', 'features/storefront/screens/BookingConfirmationPage.tsx', 'features/storefront/lib/data/brand.ts',
  ];
  for (const file of screens) {
    const source = read(file);
    assert.match(source, /from ['"]@\/features\/lib\/phone['"]/, file);
    assert.match(source, /formatPhone\(/, file);
    assert.doesNotMatch(source, /tel:\$\{[^}]*replace/, `${file} builds its own tel: link`);
  }
});
