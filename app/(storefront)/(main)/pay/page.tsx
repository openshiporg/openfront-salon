import { CardPaymentReturnPage } from "@/features/storefront/screens/CardPaymentReturnPage"

import type { Metadata } from "next"
import { storefrontTitle } from "@/features/storefront/lib/data/brand"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Payment") }
}

export default CardPaymentReturnPage
