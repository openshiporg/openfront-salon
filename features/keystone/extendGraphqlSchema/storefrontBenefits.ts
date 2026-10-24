import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";

/** Public, display-only menu of active membership plans and packages. */
export const storefrontBenefits = graphql.field({
  type: graphql.JSON,
  async resolve(_source, _args, context: Context) {
    const sudo = context.sudo();
    const [memberships, packages] = await Promise.all([
      sudo.query.Membership.findMany({ where: { isActive: { equals: true } }, orderBy: { monthlyPrice: "asc" }, take: 50, query: "id name description monthlyPrice discountPercent includedServices { id name }" }),
      sudo.query.ServicePackage.findMany({ where: { isActive: { equals: true } }, orderBy: { totalPrice: "asc" }, take: 50, query: "id name description totalPrice savingsAmount validDays services { id name }" }),
    ]);
    return {
      memberships: memberships.map((plan: any) => ({ id: plan.id, name: plan.name, description: plan.description || "", monthlyPrice: plan.monthlyPrice || 0, discountPercent: plan.discountPercent || 0, services: (plan.includedServices || []).map((service: any) => ({ id: service.id, name: service.name })) })),
      packages: packages.map((plan: any) => ({ id: plan.id, name: plan.name, description: plan.description || "", totalPrice: plan.totalPrice || 0, savingsAmount: plan.savingsAmount || 0, validDays: plan.validDays || null, services: (plan.services || []).map((service: any) => ({ id: service.id, name: service.name })) })),
    };
  },
});

/** Balance lookup by the printed code; returns only balance and validity, never the purchaser or recipient. */
export const giftCardBalance = graphql.field({
  type: graphql.JSON,
  args: { code: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  async resolve(_source, { code }, context: Context): Promise<Record<string, string | number | boolean | null>> {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length !== 12) return { found: false };
    const formatted = normalized.match(/.{1,4}/g)!.join("-");
    const card = (await context.sudo().query.GiftCard.findMany({ where: { code: { equals: formatted } }, take: 1, query: "currentBalance initialValue expiresAt isActive" }))[0];
    if (!card) return { found: false };
    const expired = Boolean(card.expiresAt && new Date(card.expiresAt).getTime() <= Date.now());
    return { found: true, balance: Number(card.currentBalance || 0), initialValue: Number(card.initialValue || 0), expiresAt: card.expiresAt ? String(card.expiresAt) : null, usable: Boolean(card.isActive) && !expired && Number(card.currentBalance || 0) > 0, expired };
  },
});
