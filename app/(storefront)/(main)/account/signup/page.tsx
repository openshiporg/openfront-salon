import { redirect } from "next/navigation";
import { AccountSignUpPage } from "@/features/storefront/screens/AccountSignUpPage";
import { getClientPortalData } from "@/features/storefront/account/actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await getClientPortalData()).status === "available") redirect("/account");
  return <AccountSignUpPage searchParams={searchParams} />;
}
