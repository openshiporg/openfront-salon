/**
 * Morrow & Mane's M&M ligature (owner pick, 2026-11-04): two Ms drawn as one monoline that share
 * the centre stem. Drawn in currentColor, so the storefront paints it in its own sage
 * (see markFollowsAccent) rather than hue-rotating a stock colour.
 */
export const DEFAULT_STORE_LOGO_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="100%" width="100%" viewBox="0 0 48 48"><path d="M6 37V12l9 15 9-15 9 15 9-15v25M24 12v25" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const DEFAULT_STORE_LOGO_COLOR = '0';

/** The sage the ligature is drawn in wherever no storefront theme is around it (dashboard previews, icons). */
export const STORE_LOGO_SAGE = '#4e5d48';

/** A mark drawn in currentColor takes the surrounding accent colour and is never hue-rotated. */
export function markFollowsAccent(svg: unknown): boolean {
  return typeof svg === 'string' && /currentcolor/i.test(svg);
}

// This module is intentionally browser-safe. Server-only SVG parsing and
// sanitization lives under features/keystone/utils/storeLogo.ts.
export function normalizeStoreLogoColor(value: unknown): string {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String(((numeric % 360) + 360) % 360);
}
