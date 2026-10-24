"use server"

import { getGraphQLEndpoint } from "../getBaseUrl"

export interface StorefrontPlan { id: string; name: string; description: string; services: { id: string; name: string }[] }
export interface StorefrontMembership extends StorefrontPlan { monthlyPrice: number; discountPercent: number }
export interface StorefrontPackage extends StorefrontPlan { totalPrice: number; savingsAmount: number; validDays: number | null }

async function publicQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const response = await fetch(await getGraphQLEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    })
    const { data, errors } = await response.json()
    if (errors) {
      console.error("GraphQL errors:", errors)
      return null
    }
    return data as T
  } catch (error) {
    console.error("Storefront request failed:", error)
    return null
  }
}

export async function getStorefrontBenefits(): Promise<{ memberships: StorefrontMembership[]; packages: StorefrontPackage[] } | null> {
  const data = await publicQuery<{ storefrontBenefits: { memberships: StorefrontMembership[]; packages: StorefrontPackage[] } }>(`query StorefrontBenefits { storefrontBenefits }`)
  return data?.storefrontBenefits || null
}

export type BalanceState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "found"; balance: number; initialValue: number; expiresAt: string | null; usable: boolean; expired: boolean }

export async function checkGiftCardBalance(_previous: BalanceState, formData: FormData): Promise<BalanceState> {
  const code = String(formData.get("code") || "").trim()
  if (code.replace(/[^a-z0-9]/gi, "").length !== 12) return { status: "error", message: "Enter the 12-character code from the card." }
  const data = await publicQuery<{ giftCardBalance: any }>(`query GiftCardBalance($code: String!) { giftCardBalance(code: $code) }`, { code })
  const result = data?.giftCardBalance
  if (!data) return { status: "error", message: "The balance couldn't be checked. Try again." }
  if (!result?.found) return { status: "error", message: "No gift card matches that code." }
  return { status: "found", balance: result.balance, initialValue: result.initialValue, expiresAt: result.expiresAt || null, usable: Boolean(result.usable), expired: Boolean(result.expired) }
}
