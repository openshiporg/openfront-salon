// Store Settings logo save path and the storefront mark rule. Offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: (id) => {
    if (id.startsWith('.')) return load(path.join(path.dirname(relative), id.endsWith('.ts') ? id : `${id}.ts`));
    if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
    return require(id);
  } }, { filename });
  return module.exports;
}

const { sanitizeStoreLogoSvg } = load('features/keystone/utils/storeLogo.ts');
const { normalizeStoreLogoColor, DEFAULT_STORE_LOGO_ICON, RETIRED_STORE_LOGO_ICONS, storeLogoFilter } = load('features/platform/store-settings/lib/store-logo.ts');
const { LOGO_ICONS } = load('features/platform/store-settings/lib/icon-registry.ts');
const { storeOwnMark } = load('features/storefront/lib/store-mark.ts');

test('the action sanitizes, normalizes, then calls the mutation and revalidates', () => {
  const src = fs.readFileSync(path.join(root, 'features/platform/store-settings/actions/store-settings.ts'), 'utf8');
  const a = src.indexOf('sanitizeStoreLogoSvg(rawLogo)');
  const b = src.indexOf('normalizeStoreLogoColor(');
  const c = src.indexOf('upsertSalonStoreSettings(');
  assert.ok(a > 0 && b > a && c > b);
  assert.match(src, /revalidatePath/);
});
test('every preset survives the sanitizer', () => { for (const icon of LOGO_ICONS) assert.ok(sanitizeStoreLogoSvg(icon.lightSvg), icon.id); });
test('hue is normalized to 0-359', () => {
  assert.equal(normalizeStoreLogoColor('390'), '30');
  assert.equal(normalizeStoreLogoColor('-30'), '330');
  assert.equal(normalizeStoreLogoColor('x'), '250');
});
test('custom SVG kept, unsafe SVG rejected', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8z"/></svg>';
  assert.equal(sanitizeStoreLogoSvg(`  ${svg}\n`), svg);
  assert.equal(sanitizeStoreLogoSvg('<svg onload="x()"></svg>'), '');
});
test('the storefront always draws an icon beside the name', () => {
  assert.ok(storeOwnMark(''));
  assert.equal(storeOwnMark(DEFAULT_STORE_LOGO_ICON), storeOwnMark(''));
  assert.match(storeOwnMark(LOGO_ICONS[1].lightSvg), /^<svg/);
});
test('the mark comes from the Untitled UI registry (Flora & Fauna, sage), and the seed uses it', () => {
  assert.equal(LOGO_ICONS.find(icon => icon.lightSvg.trim() === DEFAULT_STORE_LOGO_ICON)?.id, 'flora-fauna');
  assert.ok(LOGO_ICONS.every(icon => !/currentColor/.test(icon.lightSvg)), 'no custom marks in the picker');
  assert.equal(sanitizeStoreLogoSvg(DEFAULT_STORE_LOGO_ICON), DEFAULT_STORE_LOGO_ICON);
  assert.equal(storeLogoFilter('250'), 'hue-rotate(250deg) saturate(0.35) brightness(0.72)');
  assert.equal(storeOwnMark(RETIRED_STORE_LOGO_ICONS[0]), storeOwnMark(DEFAULT_STORE_LOGO_ICON));
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'features/platform/onboarding/lib/seed.json'), 'utf8'));
  assert.equal(seed.salonInfo.logoIcon, DEFAULT_STORE_LOGO_ICON);
  assert.equal(seed.salonInfo.logoColor, '250');
});
