/**
 * Carton band shades belong to the category, not to where a carton sits on a page.
 * The shade comes from the category's rank in the owner's display order (then name),
 * computed over the whole catalogue, so a category keeps one colour on home,
 * /services, /book and the gallery. When the ranking is unavailable the shade falls
 * back to a stable hash of the category id.
 *
 * Service-category shades are "1".."6". Non-service cartons (memberships, gift cards,
 * the account) use "ink" so they never borrow a category's colour.
 */

export type CategoryBands = Record<string, string>

/** Services without a category are shelved as one synthetic category with this id. */
export const UNCATEGORIZED_ID = "signature-services"

const SHADES = 6

function hashBand(key: string) {
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0
  return String((hash % SHADES) + 1)
}

/** Rank categories by display order, then name, then id; uncategorized services come last. */
export function bandsFromCategories(categories: Array<{ id: string; name?: string | null; displayOrder?: number | null }>): CategoryBands {
  const ranked = [...categories].sort((a, b) =>
    (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    || String(a.name || "").localeCompare(String(b.name || ""))
    || a.id.localeCompare(b.id))
  const bands: CategoryBands = {}
  ranked.forEach((category, index) => { bands[category.id] = String((index % SHADES) + 1) })
  if (!bands[UNCATEGORIZED_ID]) bands[UNCATEGORIZED_ID] = String((ranked.length % SHADES) + 1)
  return bands
}

/** The band shade for a category id (null means uncategorized). */
export function categoryBand(bands: CategoryBands | null | undefined, categoryId: string | null | undefined) {
  const key = categoryId || UNCATEGORIZED_ID
  return bands?.[key] ?? hashBand(key)
}

/**
 * The literal code printed on a carton's shade chip: category initial plus the
 * service's number within its category ("H2"). Services are numbered in the order
 * given, which on every page is the catalogue's name order.
 */
export function serviceCodes(services: Array<{ id: string; category?: { id: string; name: string } | null }>, uncategorizedName = "Signature services") {
  const counts = new Map<string, number>()
  const codes = new Map<string, string>()
  for (const service of services) {
    const key = service.category?.id || UNCATEGORIZED_ID
    const name = service.category?.name || uncategorizedName
    const next = (counts.get(key) || 0) + 1
    counts.set(key, next)
    const initial = (name.trim().charAt(0) || "S").toUpperCase()
    codes.set(service.id, `${initial}${next}`)
  }
  return codes
}
