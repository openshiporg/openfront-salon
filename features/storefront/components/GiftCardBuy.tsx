"use client"

import { useActionState, useState } from "react"
import { buyGiftCard, type GiftBuyState } from "../lib/data/benefits"

const AMOUNTS = [25, 50, 75, 100, 150, 200]
const optionClass = "sf-btn cursor-pointer !px-0 has-[:checked]:!bg-[var(--sf-ink)] has-[:checked]:!text-[var(--sf-paper)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--sf-focus)]"

/** Amount, who it's for, then Stripe's hosted card page. The code is emailed once the payment clears. */
export function GiftCardBuy() {
  const [state, action, pending] = useActionState<GiftBuyState, FormData>(buyGiftCard, { status: "idle" })
  const [amount, setAmount] = useState(50)
  const [forSomeoneElse, setForSomeoneElse] = useState(true)
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="sf-field"><legend>Amount</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {AMOUNTS.map((value) => (
            <label key={value} className={optionClass}>
              <input type="radio" name="amount" value={value * 100} checked={amount === value} onChange={() => setAmount(value)} className="sr-only" />
              <span className="sf-num">${value}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sf-field">Your name<input name="purchaserName" required maxLength={120} autoComplete="name" className="sf-input" /></label>
        <label className="sf-field">Your email<input name="purchaserEmail" type="email" required autoComplete="email" className="sf-input" /></label>
      </div>
      <label className="flex items-center gap-2 text-[length:var(--sf-text-sm)]">
        <input type="checkbox" checked={forSomeoneElse} onChange={(event) => setForSomeoneElse(event.target.checked)} className="size-4 accent-[var(--sf-ink)]" />
        Send it to someone else
      </label>
      {forSomeoneElse ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sf-field">Their name<input name="recipientName" maxLength={120} className="sf-input" /></label>
          <label className="sf-field">Their email<input name="recipientEmail" type="email" required className="sf-input" /></label>
          <label className="sf-field sm:col-span-2">Message <span className="sf-field-hint">Optional</span><textarea name="message" maxLength={500} rows={3} className="sf-input !h-auto py-2" /></label>
        </div>
      ) : null}
      <div className="sf-track self-start"><button type="submit" disabled={pending} className="sf-btn sf-btn-primary">{pending ? "Opening checkout…" : `Buy a $${amount} gift card`}</button></div>
      <p className="text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">Paid by card on a secure Stripe page. The code arrives by email and works for any service or product for a year.</p>
      {state.status === "error" ? <p role="alert" className="sf-alert">{state.message}</p> : null}
    </form>
  )
}
