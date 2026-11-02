// Client visit stats are derived from completed appointments and sales, never incremented.
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

const { clientStatsFrom, recomputeClientStats } = load('features/keystone/clientStats.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

test('visits count completed appointments only, the same rule as the client profile', () => {
  const stats = clientStatsFrom([
    { status: 'confirmed', startTime: '2026-10-26T18:00:00Z' },
    { status: 'completed', startTime: '2026-09-02T17:00:00Z' },
    { status: 'cancelled', startTime: '2026-08-01T17:00:00Z' },
    { status: 'no_show', startTime: '2026-08-02T17:00:00Z' },
    { status: 'completed', startTime: '2026-07-15T17:00:00Z' },
    { status: 'completed', startTime: null },
  ], []);
  assert.deepEqual(plain(stats), { totalVisits: 2, firstVisit: '2026-07-15T17:00:00.000Z', lastVisit: '2026-09-02T17:00:00.000Z', lifetimeValue: 0 });
});

test('a client with no completed visits reads 0 with no first or last visit', () => {
  assert.deepEqual(plain(clientStatsFrom([{ status: 'confirmed', startTime: '2026-10-26T18:00:00Z' }], [])), { totalVisits: 0, firstVisit: null, lastVisit: null, lifetimeValue: 0 });
});

test('lifetime value is pre-tax spend on completed sales less posted reversals', () => {
  const stats = clientStatsFrom([], [
    { status: 'completed', metadata: { taxable: 12000 }, reversals: [{ subtotalDelta: -2000 }] },
    { status: 'completed', metadata: {}, lineItems: [{ unitPrice: 4500, quantity: 2, discount: 500 }] },
    { status: 'voided', metadata: { taxable: 9999 } },
    { status: 'open', metadata: { taxable: 5000 } },
  ]);
  assert.equal(stats.lifetimeValue, 10000 + 8500);
  assert.equal(clientStatsFrom([], [{ status: 'completed', metadata: { taxable: 1000 }, reversals: [{ subtotalDelta: -1500 }] }]).lifetimeValue, 0);
});

test('recompute reads completed rows and writes all four stats to the client', async () => {
  const calls = [];
  const sudo = { query: {
    Appointment: { findMany: async (args) => { calls.push(['appointments', args.where]); return [{ status: 'completed', startTime: '2026-10-01T10:00:00Z' }]; } },
    SalonTransaction: { findMany: async (args) => { calls.push(['sales', args.where]); return [{ status: 'completed', metadata: { taxable: 6500 }, reversals: [] }]; } },
    Client: { updateOne: async (args) => { calls.push(['update', args]); return { id: args.where.id }; } },
  } };
  await recomputeClientStats(sudo, 'c1');
  const update = calls.find(([kind]) => kind === 'update')[1];
  assert.deepEqual(plain(update.data), { totalVisits: 1, firstVisit: '2026-10-01T10:00:00.000Z', lastVisit: '2026-10-01T10:00:00.000Z', lifetimeValue: 6500 });
  assert.deepEqual(plain(calls[0][1]), { client: { id: { equals: 'c1' } }, status: { equals: 'completed' } });
  assert.equal(await recomputeClientStats(sudo, null), null);
});

test('checkout and reversals recompute instead of incrementing, and nobody can write the stats', () => {
  const checkout = read('features/keystone/mutations/completeAppointmentCheckout.ts');
  const reversal = read('features/keystone/mutations/reversalWorkflows.ts');
  for (const source of [checkout, reversal]) {
    assert.match(source, /recomputeClientStats\(sudo,/);
    assert.doesNotMatch(source, /totalVisits:\s*\(|lifetimeValue:\s*(\(|Math\.max)/);
  }
  // Recompute runs after the appointment is marked completed, so the visit it just finished counts.
  assert.ok(checkout.indexOf('recomputeClientStats(sudo') > checkout.indexOf('data: { status: "completed", metadata'));
  const model = read('features/keystone/models/Client.ts');
  assert.match(model, /const derived = \{ create: \(\) => false, update: \(\) => false \}/);
  for (const field of ['firstVisit', 'lastVisit', 'totalVisits', 'lifetimeValue']) assert.match(model, new RegExp(`${field}: (timestamp|integer)\\(\\{\\n(?:(?!    [a-zA-Z]+: [a-z]+\\(\\{).*\\n)*?\\s*access: derived`));
  assert.doesNotMatch(read('features/keystone/mutations/bookAppointment.ts'), /firstVisit|totalVisits|lifetimeValue/);
  const migration = read('migrations/20261101230000_derive_client_stats/migration.sql');
  assert.match(migration, /a\."status" = 'completed'/);
  assert.match(migration, /LEFT JOIN visits/);
});

test('the client list shows lifetime value in dollars, not raw cents', () => {
  const model = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'features/keystone/models/Client.ts'), 'utf8');
  assert.match(model, /initialColumns: \[[^\]]*"totalVisits", "lifetimeSpend"\]/);
  assert.match(model, /lifetimeSpend: virtual\([\s\S]*lifetimeValue[\s\S]*\/ 100[\s\S]*minimumFractionDigits: 2/);
});
