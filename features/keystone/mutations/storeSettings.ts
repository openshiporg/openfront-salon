import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { STOREFRONT_SETTINGS_SCOPE } from "../models/StoreSettings";
import { parseStorefrontHue } from "../../lib/storefront-theme";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor, storeLogoHue } from "../../lib/store-logo";
import { serializableWorkflow } from "./serializableWorkflow";

type StoreSettingsMutationResult = {
  id: string;
  name: string;
  description: string | null;
  themeHue: number;
  primaryLocationId: string;
};

const resultType = graphql.object<StoreSettingsMutationResult>()({
  name: "SalonStoreSettingsMutationResult",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.nonNull(graphql.String) }),
    description: graphql.field({ type: graphql.String }),
    themeHue: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    primaryLocationId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
  },
});

function boundedText(value: unknown, label: string, max: number, required = false): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return text;
}

export async function upsertSalonStoreSettingsTransaction(
  context: Context,
  input: { name: string; description?: string | null; themeHue: number; primaryLocationId: string; logoIcon?: string | null; logoColor?: string | null },
): Promise<StoreSettingsMutationResult> {
  if (!context.session || context.session.data?.role?.canManageSalon !== true) {
    throw new Error("You do not have permission to manage storefront settings");
  }

  const name = boundedText(input.name, "Storefront name", 120, true);
  const description = boundedText(input.description, "Storefront description", 240);
  const themeHue = input.logoColor == null ? parseStorefrontHue(input.themeHue) : storeLogoHue(input.logoColor);
  const primaryLocationId = boundedText(input.primaryLocationId, "Primary location", 200, true);

  const location = await context.query.Location.findOne({
    where: { id: primaryLocationId },
    query: "id isActive",
  });
  if (!location || location.isActive !== true) {
    throw new Error("Primary location must be an active location you can manage");
  }

  const logoIcon = input.logoIcon == null ? undefined : sanitizeStoreLogoSvg(input.logoIcon);
  if (input.logoIcon && !logoIcon) throw new Error("Logo must be a valid, safe SVG document");
  const logoColor = input.logoColor == null ? undefined : normalizeStoreLogoColor(input.logoColor);
  return serializableWorkflow(context, "salon-store-settings", [STOREFRONT_SETTINGS_SCOPE], async (transactionContext) => {
    const actor = await transactionContext.query.User.findOne({ where: { id: context.session!.itemId }, query: "id role { canManageSalon }" });
    if (actor?.role?.canManageSalon !== true) throw new Error("Current store settings authority is required");
    const active = await transactionContext.query.Location.findOne({ where: { id: primaryLocationId }, query: "id isActive" });
    if (!active?.isActive) throw new Error("Primary location is no longer active");
    const sudo = transactionContext.sudo();
    const existing = await sudo.query.StoreSettings.findMany({
      where: { scope: { equals: STOREFRONT_SETTINGS_SCOPE } },
      take: 2,
      orderBy: { createdAt: "asc" },
      query: "id",
    });
    if (existing.length > 1) throw new Error("Storefront settings invariant violated");

    const data = {
      scope: STOREFRONT_SETTINGS_SCOPE,
      name,
      description: description || null,
      themeHue,
      ...(logoIcon === undefined ? {} : { logoIcon }),
      ...(logoColor === undefined ? {} : { logoColor }),
      primaryLocation: { connect: { id: primaryLocationId } },
    };
    const record = existing[0]
      ? await sudo.query.StoreSettings.updateOne({ where: { id: existing[0].id }, data, query: "id name description themeHue primaryLocation { id }" })
      : await sudo.query.StoreSettings.createOne({ data, query: "id name description themeHue primaryLocation { id }" });

    return {
      id: record.id,
      name: record.name,
      description: record.description || null,
      themeHue: record.themeHue,
      primaryLocationId: record.primaryLocation?.id || primaryLocationId,
    };
  });
}

export const upsertSalonStoreSettings = graphql.field({
  type: graphql.nonNull(resultType),
  args: {
    name: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    description: graphql.arg({ type: graphql.String }),
    themeHue: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    primaryLocationId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    logoIcon: graphql.arg({ type: graphql.String }),
    logoColor: graphql.arg({ type: graphql.String }),
  },
  resolve(_source, args, context: Context) {
    return upsertSalonStoreSettingsTransaction(context, args);
  },
});
