// Which PaymentProvider changes staff may make. Providers are created by onboarding
// and their adapter wiring stays code-controlled; staff with payment authority may
// only switch an existing provider on or off. Pure so the rule is testable.

/** The only field the dashboard may write. */
export const ACTIVATION_FIELDS = ["isInstalled"] as const;

type ProviderItem = { adapter?: string | null; isDefault?: boolean | null; isInstalled?: boolean | null } | null | undefined;

/** Returns the reason an update is refused, or null when it is allowed. */
export function providerUpdateProblem(args: {
  inputData: Record<string, unknown> | null | undefined;
  item: ProviderItem;
  stripeKeyConfigured: boolean;
}): string | null {
  const input = args.inputData || {};
  const extra = Object.keys(input).filter((field) => !(ACTIVATION_FIELDS as readonly string[]).includes(field));
  if (extra.length) return `Only isInstalled can be changed from the dashboard (not ${extra.join(", ")}).`;
  if (!("isInstalled" in input)) return null;
  const installing = input.isInstalled === true;
  if (installing && args.item?.adapter === "stripe" && !args.stripeKeyConfigured) {
    return "Stripe needs STRIPE_SECRET_KEY set on the server first.";
  }
  if (!installing && args.item?.isDefault) {
    return "The default provider takes in-salon payments and can't be switched off.";
  }
  return null;
}
