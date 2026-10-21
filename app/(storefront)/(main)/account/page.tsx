import type { Metadata } from "next";
import { AccountPage } from "@/features/storefront/screens";
import { getClientPortalData } from "@/features/storefront/account/actions";
import { getStorefrontBrand, storefrontTitle } from "@/features/storefront/lib/data/brand";
import { accountPresentation, type AccountSearchParams } from "@/features/storefront/lib/account-presentation";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand();
  return {
    title: await storefrontTitle("My Account"),
    description: brand.name ? `Manage your ${brand.name} appointments.` : "Manage your appointments.",
  };
}
export default async function Page({ searchParams }: { searchParams: Promise<AccountSearchParams> }) {
  const [portal, params] = await Promise.all([getClientPortalData(), searchParams]);
  const { message, consultationUnresolved, consultationAttempt } = accountPresentation(params);
  return <AccountPage portal={portal} message={message} consultationUnresolved={consultationUnresolved} consultationAttempt={consultationAttempt} />;
}
