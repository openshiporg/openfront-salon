import { MembershipJoinedPage } from "@/features/storefront/screens/MembershipJoinedPage"

import type { Metadata } from "next"
import { storefrontTitle } from "@/features/storefront/lib/data/brand"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Membership") }
}

export default MembershipJoinedPage
