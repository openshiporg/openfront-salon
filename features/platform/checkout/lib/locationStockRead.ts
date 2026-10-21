import type { LocationStockPage } from "@/features/keystone/inventory/locationStockRead";

/** Treat denied, partial, mismatched, and malformed projection payloads as unavailable, not zero stock. */
export function resolveLocationStockResponse(success: boolean, value: unknown, locationId: string): LocationStockPage | null {
  if (!success || !value || typeof value !== "object") return null;
  const page = value as LocationStockPage;
  if (!page.location || page.location.id !== locationId || typeof page.location.name !== "string"
    || !Number.isInteger(page.skip) || page.skip < 0 || !Number.isInteger(page.take) || page.take < 1 || page.take > 30
    || typeof page.hasMore !== "boolean" || !Array.isArray(page.products) || page.products.length > page.take) return null;
  const seen = new Set<string>();
  for (const product of page.products) {
    if (!product || typeof product.id !== "string" || !product.id || seen.has(product.id)
      || typeof product.name !== "string" || (product.sku !== null && typeof product.sku !== "string")
      || !Number.isSafeInteger(product.price) || product.price < 0 || !Number.isSafeInteger(product.localQuantity)
      || product.localQuantity < 0 || product.localQuantity > 2147483647) return null;
    seen.add(product.id);
  }
  return page;
}
