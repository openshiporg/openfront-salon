import type { Metadata } from "next";
import { storefrontTitle } from "@/features/storefront/lib/data/brand";
import { AccountResetPage } from "@/features/storefront/screens/AccountResetPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Reset password") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; email?: string; status?: string }> }) {
  const params = await searchParams;
  return <AccountResetPage token={params.token} email={params.email} status={params.status} />;
}
