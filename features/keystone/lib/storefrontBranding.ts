import type { Context } from ".keystone/types";
import { UNCONFIGURED_STOREFRONT_HUE } from "../../lib/storefront-theme";
import { STOREFRONT_SETTINGS_SCOPE } from "../models/StoreSettings";
import { storeLogoHue } from "../../lib/store-logo";

export type StorefrontMessageBrand = { name: string | null; themeHue: number };

export async function getStorefrontMessageBrand(context: Context): Promise<StorefrontMessageBrand> {
  const rows = await context.sudo().query.StoreSettings.findMany({
    where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
    take: 2,
    orderBy: { createdAt: "asc" },
    query: "name logoColor primaryLocation { id isActive }",
  });
  if (rows.length !== 1 || !rows[0].primaryLocation?.id || rows[0].primaryLocation.isActive !== true) {
    return { name: null, themeHue: UNCONFIGURED_STOREFRONT_HUE };
  }
  const name = typeof rows[0].name === "string" ? rows[0].name.trim() : "";
  return { name: name || null, themeHue: storeLogoHue(rows[0].logoColor) };
}
