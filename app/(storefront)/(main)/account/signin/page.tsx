import { redirect } from "next/navigation";
import { AccountSignInPage } from "@/features/storefront/screens";
import { parseConsultationRetryAttempt } from "@/features/storefront/account/consultationSubmitOutcome";
import { getClientPortalData } from "@/features/storefront/account/actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; consultation?: string; consultationTemplate?: string; consultationKey?: string }> }) {
  const [params, portal] = await Promise.all([searchParams, getClientPortalData()]);
  if (portal.status === "available") redirect("/account");
  const consultationUnresolved = params.consultation === "unresolved";
  const consultationAttempt = parseConsultationRetryAttempt(params.consultation, params.consultationTemplate, params.consultationKey);
  return <AccountSignInPage error={params.error} consultationUnresolved={consultationUnresolved} consultationAttempt={consultationAttempt} />;
}
