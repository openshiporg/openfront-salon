import type { Metadata } from "next";
import { storefrontTitle } from "@/features/storefront/lib/data/brand";
import { redirect } from "next/navigation";
import { AccountSignInPage } from "@/features/storefront/screens";
import { parseConsultationRetryAttempt } from "@/features/storefront/account/consultationSubmitOutcome";
import { getClientPortalData, getSignInEmail } from "@/features/storefront/account/actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Sign in") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; consultation?: string; consultationTemplate?: string; consultationKey?: string }> }) {
  const [params, portal, email] = await Promise.all([searchParams, getClientPortalData(), getSignInEmail()]);
  if (portal.status === "available") redirect("/account");
  const consultationUnresolved = params.consultation === "unresolved";
  const consultationAttempt = parseConsultationRetryAttempt(params.consultation, params.consultationTemplate, params.consultationKey);
  return <AccountSignInPage error={params.error} email={email} consultationUnresolved={consultationUnresolved} consultationAttempt={consultationAttempt} />;
}
