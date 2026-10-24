// Salon scheduling, storefront-hours and money helpers. Node's built-in runner with the same
// TypeScript sandbox as shared-dashboard.test.cjs. No DB, network or real env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const cache = new Map();
  function run(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (specifier) => {
      const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(filename), specifier) : null;
      if (resolved && fs.existsSync(`${resolved}.ts`)) return run(`${resolved}.ts`);
      return new Proxy({}, { get: () => () => null });
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, process: { env: {} }, console, URL, Intl, Date, Math, Number, crypto: globalThis.crypto }, { filename });
    return module.exports;
  }
  return run(path.resolve(root, relative));
}

test('a booking blocks the stylist for the longest buffer among its services, defaulting to 15 minutes', () => {
  const { serviceBuffer, MAX_BUFFER_MINUTES } = load('features/keystone/scheduling/availability.ts');
  assert.equal(serviceBuffer([]), 15);
  assert.equal(serviceBuffer([{ bufferMinutes: null }]), 15);
  assert.equal(serviceBuffer([{ bufferMinutes: 0 }]), 0);
  assert.equal(serviceBuffer([{ bufferMinutes: 5 }, { bufferMinutes: 30 }]), 30);
  assert.equal(serviceBuffer([{ bufferMinutes: 500 }]), MAX_BUFFER_MINUTES);
});

test('the open badge never promises appointments after the last shift ends', () => {
  const { openStatus } = load('features/storefront/lib/hours.ts');
  const hours = { friday: { open: '09:00', close: '21:00', closed: false } };
  const roster = [{ isActive: true, schedules: [{ dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isAvailable: true }] }];
  const fridayAt = (hh) => new Date(`2026-10-23T${String(hh).padStart(2, '0')}:00:00Z`);
  assert.equal(openStatus(hours, 'UTC', fridayAt(10)).label, 'Open · until 9pm');
  assert.equal(openStatus(hours, 'UTC', fridayAt(10), roster).label, 'Open · appointments until 6pm');
  assert.equal(openStatus(hours, 'UTC', fridayAt(19), roster).label, 'Open · no appointments left today');
});

test('roster hours list days nobody works as no appointments', () => {
  const { bookableHours } = load('features/storefront/lib/hours.ts');
  const result = bookableHours([{ isActive: true, schedules: [{ dayOfWeek: 1, startTime: '10:00', endTime: '16:00', isAvailable: true }] }]);
  assert.equal(result.monday, '10:00 AM – 4:00 PM');
  assert.equal(result.sunday, 'No appointments');
});

test('lifecycle gates mirror the server: check-in on the service day, no-show after start', () => {
  const { lifecycleGates } = load('features/platform/appointments/lib/lifecycleGates.ts');
  const now = new Date('2026-10-23T17:00:00Z');
  const tomorrow = lifecycleGates('2026-10-24T16:00:00Z', 'UTC', now);
  assert.match(tomorrow.checkIn, /day of the appointment/);
  assert.match(tomorrow.noShow, /after the start time/);
  const past = lifecycleGates('2026-10-23T15:00:00Z', 'UTC', now);
  assert.equal(past.checkIn, null);
  assert.equal(past.noShow, null);
});

test('staff money input converts dollars to integer cents and rejects malformed values', () => {
  const { dollarsToCents } = load('features/platform/lib/formState.ts');
  assert.equal(dollarsToCents('12.50'), 1250);
  assert.equal(dollarsToCents('$1,200'), 120000);
  assert.equal(dollarsToCents('12.345'), null);
  assert.equal(dollarsToCents(''), null);
});

test('loyalty points round down per dollar of paid spend', () => {
  const { pointsForSpend } = load('features/keystone/loyalty.ts');
  assert.equal(pointsForSpend({ pointsPerDollar: 1 }, 8599), 85);
  assert.equal(pointsForSpend({ pointsPerDollar: 2 }, 1000), 20);
  assert.equal(pointsForSpend(null, 1000), 0);
});
