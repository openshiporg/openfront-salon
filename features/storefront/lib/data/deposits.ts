"use server"

import { gql } from "graphql-request"
import { requestSalon } from "../session-client"

export type DepositStart = { ok: true; url: string } | { ok: false; error: string }
export type DepositStatus = { ok: boolean; paid: boolean; status: string | null; error: string | null }

/** Opens the hosted Stripe Checkout for a booking's deposit. */
export async function startDepositCheckout(appointmentId: string, accessToken: string | null): Promise<DepositStart> {
  const MUTATION = gql`
    mutation StartDepositCheckout($appointmentId: ID!, $accessToken: String) {
      startDepositCheckout(appointmentId: $appointmentId, accessToken: $accessToken) { success error url }
    }
  `
  try {
    const data = await requestSalon<{ startDepositCheckout?: { success: boolean; error: string | null; url: string | null } }>(MUTATION, { appointmentId, accessToken })
    const result = data.startDepositCheckout
    if (result?.success && result.url) return { ok: true, url: result.url }
    return { ok: false, error: result?.error || "Online deposits are unavailable right now. Pay the deposit at the salon." }
  } catch (error) {
    console.error("Error starting deposit checkout:", error)
    return { ok: false, error: "Online deposits are unavailable right now. Pay the deposit at the salon." }
  }
}

/** Reads the Checkout back from the payment provider; the browser's redirect is never trusted. */
export async function confirmDepositCheckout(appointmentId: string, accessToken: string | null): Promise<DepositStatus> {
  const MUTATION = gql`
    mutation ConfirmDepositCheckout($appointmentId: ID!, $accessToken: String) {
      confirmDepositCheckout(appointmentId: $appointmentId, accessToken: $accessToken) { success error paid status }
    }
  `
  try {
    const data = await requestSalon<{ confirmDepositCheckout?: { success: boolean; error: string | null; paid: boolean; status: string | null } }>(MUTATION, { appointmentId, accessToken })
    const result = data.confirmDepositCheckout
    return { ok: Boolean(result?.success), paid: Boolean(result?.paid), status: result?.status ?? null, error: result?.error ?? null }
  } catch (error) {
    console.error("Error confirming deposit:", error)
    return { ok: false, paid: false, status: null, error: "We could not check the deposit yet. Try again in a moment." }
  }
}
