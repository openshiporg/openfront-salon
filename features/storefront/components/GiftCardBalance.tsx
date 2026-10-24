"use client"

import { useActionState } from "react"
import { checkGiftCardBalance, type BalanceState } from "../lib/data/benefits"
import { formatMenuPrice } from "../lib/format-price"

/** Balance lookup by the code printed on the card. */
export function GiftCardBalance() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkGiftCardBalance, { status: "idle" })
  return (
    <form action={action} className="grid gap-3">
      <label className="sf-field">Gift card code<input name="code" required maxLength={20} autoComplete="off" placeholder="XXXX-XXXX-XXXX" className="sf-input font-mono uppercase tracking-wider" /></label>
      <div className="sf-track self-start"><button type="submit" disabled={pending} className="sf-btn">{pending ? "Checking…" : "Check balance"}</button></div>
      {state.status === "error" ? <p role="alert" className="sf-alert">{state.message}</p> : null}
      {state.status === "found" ? (
        <p role="status" className="sf-note">
          <strong className="tabular-nums">{formatMenuPrice(state.balance)}</strong> of {formatMenuPrice(state.initialValue)} left
          {state.expired ? " · expired" : state.expiresAt ? ` · valid until ${new Date(state.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
          {!state.usable && !state.expired && state.balance > 0 ? " · not active" : ""}
        </p>
      ) : null}
    </form>
  )
}
