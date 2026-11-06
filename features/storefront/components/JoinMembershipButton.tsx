"use client"

import { useActionState } from "react"
import { joinMembership, type JoinState } from "../lib/data/benefits"

export function JoinMembershipButton({ membershipId, label }: { membershipId: string; label: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinMembership, { status: "idle" })
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="sf-track sf-track-block"><button type="submit" disabled={pending} className="sf-btn sf-btn-primary">{pending ? "Opening checkout…" : label}</button></div>
      {state.status === "error" ? <p role="alert" className="sf-alert">{state.message}</p> : null}
    </form>
  )
}
