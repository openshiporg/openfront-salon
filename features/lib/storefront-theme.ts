export const STOREFRONT_HUE_MIN = 0;
export const STOREFRONT_HUE_MAX = 359;
export const UNCONFIGURED_STOREFRONT_HUE = 0;

export function isValidStorefrontHue(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= STOREFRONT_HUE_MIN && Number(value) <= STOREFRONT_HUE_MAX;
}

export function parseStorefrontHue(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!isValidStorefrontHue(numeric)) {
    throw new Error(`Theme hue must be an integer from ${STOREFRONT_HUE_MIN} to ${STOREFRONT_HUE_MAX}`);
  }
  return numeric;
}

export function safeStorefrontHue(value: unknown): number {
  try {
    return parseStorefrontHue(value);
  } catch {
    return UNCONFIGURED_STOREFRONT_HUE;
  }
}

export function storefrontManifestColor(value: unknown): string {
  return `hsl(${safeStorefrontHue(value)} 24% 96%)`;
}
