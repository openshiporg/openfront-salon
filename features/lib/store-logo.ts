// E-commerce's constants and normalizer are the source of truth; the salon-only
// helpers below theme the storefront from the saved logo colour.
import { DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR, normalizeStoreLogoColor } from '../platform/store-settings/lib/store-logo';

export { DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR, normalizeStoreLogoColor };

// The logo colour also themes the storefront, as in E-commerce and Restaurant.
export function storeLogoHue(value: unknown): number {
  return Math.round(Number(normalizeStoreLogoColor(value))) % 360;
}

/** The default mark is drawn in the storefront accent (see storefront-tokens.css), never its stock blue. */
export const DEFAULT_STORE_LOGO_ACCENT_SVG = DEFAULT_STORE_LOGO_ICON.replace('fill="#155eef"', 'fill="currentColor"');

export function isDefaultStoreLogo(value: unknown) {
  return !value || value === DEFAULT_STORE_LOGO_ICON;
}

export function storeLogoAccent(value: unknown) {
  return `oklch(55% 0.13 ${storeLogoHue(value)})`;
}
