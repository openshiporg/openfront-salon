"use server"

import { getServerGraphQLTarget } from "../getBaseUrl"

export interface StorefrontPlan { id: string; name: string; description: string; services: { id: string; name: string }[] }
export interface StorefrontMembership extends StorefrontPlan { monthlyPrice: number; discountPercent: number }
export interface StorefrontPackage extends StorefrontPlan { totalPrice: number; savingsAmount: number; validDays: number | null }

async function publicQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const target = await getServerGraphQLTarget()
    const response = await (target.fetch ?? fetch)(target.endpoint, {
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

export type GiftBuyState = { status: "idle" } | { status: "error"; message: string }

/** Opens Stripe's hosted page for an online gift card; on success the browser is sent there. */
export async function buyGiftCard(_previous: GiftBuyState, formData: FormData): Promise<GiftBuyState> {
  const { requestSalon } = await import("../session-client")
  const { redirect } = await import("next/navigation")
  let url: string | null = null
  try {
    const data = await requestSalon<{ startGiftCardCheckout: { success: boolean; error: string | null; url: string | null } }>(
      `mutation BuyGiftCard($amount: Int!, $purchaserName: String!, $purchaserEmail: String!, $recipientName: String, $recipientEmail: String, $message: String) {
        startGiftCardCheckout(amount: $amount, purchaserName: $purchaserName, purchaserEmail: $purchaserEmail, recipientName: $recipientName, recipientEmail: $recipientEmail, message: $message) { success error url }
      }`,
      {
        amount: Number(formData.get("amount") || 0),
        purchaserName: String(formData.get("purchaserName") || ""),
        purchaserEmail: String(formData.get("purchaserEmail") || ""),
        recipientName: String(formData.get("recipientName") || "") || null,
        recipientEmail: String(formData.get("recipientEmail") || "") || null,
        message: String(formData.get("message") || "") || null,
      },
    )
    if (!data.startGiftCardCheckout.success || !data.startGiftCardCheckout.url) return { status: "error", message: data.startGiftCardCheckout.error || "Online gift cards are unavailable right now." }
    url = data.startGiftCardCheckout.url
  } catch (error) {
    console.error("Gift card checkout failed:", error)
    return { status: "error", message: "Online gift cards are unavailable right now. Buy one at the salon." }
  }
  redirect(url!)
  return { status: "idle" }
}

export type GiftOrder = { ok: boolean; status: string | null; code: string | null; amount: number | null; recipientEmail: string | null; error: string | null }

export async function confirmGiftCardOrder(sessionId: string, token: string): Promise<GiftOrder> {
  const { requestSalon } = await import("../session-client")
  try {
    const data = await requestSalon<{ confirmGiftCardOrder: { success: boolean; error: string | null; status: string | null; code: string | null; amount: number | null; recipientEmail: string | null } }>(
      `mutation GiftOrder($sessionId: ID!, $token: String!) { confirmGiftCardOrder(sessionId: $sessionId, token: $token) { success error status code amount recipientEmail } }`,
      { sessionId, token },
    )
    const r = data.confirmGiftCardOrder
    return { ok: r.success, status: r.status, code: r.code, amount: r.amount, recipientEmail: r.recipientEmail, error: r.error }
  } catch (error) {
    console.error("Gift card order check failed:", error)
    return { ok: false, status: null, code: null, amount: null, recipientEmail: null, error: "We could not check the payment yet. Refresh in a moment." }
  }
}

export type JoinState = { status: "idle" } | { status: "error"; message: string }

/** Opens Stripe's subscription page for a membership; the signed-in client is billed monthly. */
export async function joinMembership(_previous: JoinState, formData: FormData): Promise<JoinState> {
  const { requestSalon } = await import("../session-client")
  const { redirect } = await import("next/navigation")
  let url: string | null = null
  try {
    const data = await requestSalon<{ startMembershipCheckout: { success: boolean; error: string | null; url: string | null } }>(
      `mutation JoinMembership($membershipId: ID!) { startMembershipCheckout(membershipId: $membershipId) { success error url } }`,
      { membershipId: String(formData.get("membershipId") || "") },
    )
    if (!data.startMembershipCheckout.success || !data.startMembershipCheckout.url) return { status: "error", message: data.startMembershipCheckout.error || "Online sign-up is unavailable right now." }
    url = data.startMembershipCheckout.url
  } catch (error) {
    console.error("Membership checkout failed:", error)
    return { status: "error", message: "Online sign-up is unavailable right now. Ask at the salon." }
  }
  redirect(url!)
  return { status: "idle" }
}

export type MembershipSignup = { ok: boolean; status: string | null; planName: string | null; amount: number | null; nextBillingDate: string | null; error: string | null }

export async function confirmMembershipSignup(sessionId: string, token: string): Promise<MembershipSignup> {
  const { requestSalon } = await import("../session-client")
  try {
    const data = await requestSalon<{ confirmMembershipSignup: { success: boolean; error: string | null; status: string | null; planName: string | null; amount: number | null; nextBillingDate: string | null } }>(
      `mutation MembershipSignup($sessionId: ID!, $token: String!) { confirmMembershipSignup(sessionId: $sessionId, token: $token) { success error status planName amount nextBillingDate } }`,
      { sessionId, token },
    )
    const r = data.confirmMembershipSignup
    return { ok: r.success, status: r.status, planName: r.planName, amount: r.amount, nextBillingDate: r.nextBillingDate, error: r.error }
  } catch (error) {
    console.error("Membership sign-up check failed:", error)
    return { ok: false, status: null, planName: null, amount: null, nextBillingDate: null, error: "We could not check the payment yet. Refresh in a moment." }
  }
}
