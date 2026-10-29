"use client"

import { useState } from "react"
import { startDepositCheckout } from "../lib/data/deposits"
import { formatMenuPrice } from "../lib/format-price"

/** Sends the guest to the hosted card checkout for the booking's deposit. */
export function PayDepositButton({ appointmentId, accessToken, amount }: { appointmentId: string; accessToken: string | null; amount?: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setBusy(true)
    setError(null)
    const result = await startDepositCheckout(appointmentId, accessToken)
    if (result.ok) {
      window.location.assign(result.url)
      return
    }
    setError(result.error)
    setBusy(false)
  }

  return (
    <div className="grid gap-2">
      <button type="button" className="sf-btn sf-btn-primary self-start" onClick={pay} disabled={busy}>
        {busy ? "Opening checkout…" : amount ? `Pay ${formatMenuPrice(amount / 100)} deposit by card` : "Pay deposit by card"}
      </button>
      {error ? <p role="alert" className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{error}</p> : null}
    </div>
  )
}
