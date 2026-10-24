"use server"

import { randomUUID } from "node:crypto"
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient"

export type WaitlistJoinResult = { status: "joined" } | { status: "error"; message: string }

/** Signed-in clients ask to hear about an opening for the chosen service and day. */
export async function joinWaitlistForDay(input: { serviceId: string; stylistId?: string | null; localDate: string }): Promise<WaitlistJoinResult> {
  const response = await keystoneClient<{ joinWaitlistAsClient: { success: boolean; error?: string | null } }>(`
    mutation JoinWaitlistAsClient($serviceId: ID!, $stylistId: ID, $localDate: String!, $idempotencyKey: String!) {
      joinWaitlistAsClient(serviceId: $serviceId, stylistId: $stylistId, localDate: $localDate, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { serviceId: input.serviceId, stylistId: input.stylistId || null, localDate: input.localDate, idempotencyKey: `web-waitlist:${randomUUID()}` })
  if (!response.success) return { status: "error", message: "The waitlist request couldn't be sent. Try again." }
  return response.data.joinWaitlistAsClient.success ? { status: "joined" } : { status: "error", message: response.data.joinWaitlistAsClient.error || "The waitlist request couldn't be sent." }
}
