import Link from "next/link"
import { Check } from "lucide-react"

/** Where Stripe sends a client after paying at the front desk (or from a link the salon texted). The desk confirms with Stripe directly. */
export async function CardPaymentReturnPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams
  const paid = result === "paid"
  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-carton" data-band="ink" data-selected={paid ? "true" : undefined}>
          {paid ? <div className="sf-carton-band"><span className="sf-tick"><Check aria-hidden="true" /></span></div> : null}
          <div className="grid gap-3 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
            <h1 className="sf-display text-[length:var(--sf-text-3xl)]">{paid ? "Payment received" : "Payment not taken"}</h1>
            <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">
              {paid ? "Thank you. The front desk sees your payment now." : "No charge was made. Let the front desk know and they can send a new payment link."}
            </p>
          </div>
          <div className="sf-track border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)]">
            <Link href="/book" className="sf-btn sf-btn-primary">Book your next visit</Link>
            <Link href="/" className="sf-btn sf-btn-quiet">Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
