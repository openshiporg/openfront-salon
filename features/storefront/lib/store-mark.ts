import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo"
import { DEFAULT_STORE_LOGO_ICON } from "@/features/lib/store-logo"
import { RETIRED_STORE_LOGO_ICONS } from "@/features/platform/store-settings/lib/store-logo"

/**
 * The mark shown beside the store name: the one saved in Store Settings, sanitized.
 * The icon is always shown, as in E-commerce; when nothing valid is saved the
 * platform default icon stands in. It is never hidden.
 */
export function storeOwnMark(logoIcon: string | null | undefined): string {
  const raw = (logoIcon || "").trim()
  // The retired custom M&M ligature gives way to the registry default.
  if (RETIRED_STORE_LOGO_ICONS.includes(raw)) return sanitizeStoreLogoSvg(DEFAULT_STORE_LOGO_ICON)
  return (raw && sanitizeStoreLogoSvg(raw)) || sanitizeStoreLogoSvg(DEFAULT_STORE_LOGO_ICON)
}
