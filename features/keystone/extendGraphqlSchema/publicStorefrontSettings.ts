import { graphql } from "@keystone-6/core";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor, storeLogoHue } from "../../lib/store-logo";
import type { Context } from ".keystone/types";
import type { JSONValue } from "@keystone-6/core/types";
import { STOREFRONT_SETTINGS_SCOPE } from "../models/StoreSettings";
import { UNCONFIGURED_STOREFRONT_HUE } from "../../lib/storefront-theme";

type PublicLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  email: string | null;
  hours: JSONValue;
  timezone: string | null;
};

type PublicStorefrontSettingsResult = {
  configured: boolean;
  name: string | null;
  description: string | null;
  themeHue: number;
  logoIcon: string;
  logoColor: string;
  primaryLocation: PublicLocation | null;
};

const publicLocationType = graphql.object<PublicLocation>()({
  name: "PublicSalonLocation",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.nonNull(graphql.String) }),
    address: graphql.field({ type: graphql.nonNull(graphql.String) }),
    city: graphql.field({ type: graphql.nonNull(graphql.String) }),
    state: graphql.field({ type: graphql.nonNull(graphql.String) }),
    zipCode: graphql.field({ type: graphql.nonNull(graphql.String) }),
    phone: graphql.field({ type: graphql.String }),
    email: graphql.field({ type: graphql.String }),
    hours: graphql.field({ type: graphql.JSON, resolve: (source) => source.hours }),
    timezone: graphql.field({ type: graphql.String }),
  },
});

const publicStorefrontSettingsType = graphql.object<PublicStorefrontSettingsResult>()({
  name: "PublicSalonStorefrontSettings",
  fields: {
    configured: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    name: graphql.field({ type: graphql.String }),
    description: graphql.field({ type: graphql.String }),
    themeHue: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    logoIcon: graphql.field({ type: graphql.nonNull(graphql.String) }),
    logoColor: graphql.field({ type: graphql.nonNull(graphql.String) }),
    primaryLocation: graphql.field({ type: publicLocationType }),
  },
});

const unconfigured = (): PublicStorefrontSettingsResult => ({
  configured: false,
  name: null,
  description: null,
  themeHue: UNCONFIGURED_STOREFRONT_HUE,
  logoIcon: "",
  logoColor: "0",
  primaryLocation: null,
});

export const publicStorefrontSettings = graphql.field({
  type: graphql.nonNull(publicStorefrontSettingsType),
  async resolve(_source, _args, context: Context): Promise<PublicStorefrontSettingsResult> {
    const rows = await context.sudo().query.StoreSettings.findMany({
      where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
      take: 2,
      orderBy: { createdAt: "asc" },
      query: `
        id
        name
        description
        themeHue logoIcon logoColor
        primaryLocation {
          id name address city state zipCode phone email hours timezone isActive
        }
      `,
    });

    if (rows.length !== 1) return unconfigured();
    const settings = rows[0];
    const name = typeof settings.name === "string" ? settings.name.trim() : "";
    const location = settings.primaryLocation;
    if (!name || !location?.id || location.isActive !== true) return unconfigured();

    return {
      configured: true,
      name,
      description: typeof settings.description === "string" && settings.description.trim() ? settings.description.trim() : null,
      themeHue: storeLogoHue(settings.logoColor),
      logoIcon: sanitizeStoreLogoSvg(settings.logoIcon || ""),
      logoColor: normalizeStoreLogoColor(settings.logoColor),
      primaryLocation: {
        id: location.id,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zipCode: location.zipCode,
        phone: location.phone || null,
        email: location.email || null,
        hours: location.hours || null,
        timezone: location.timezone || null,
      },
    };
  },
});
