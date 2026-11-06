import Link from "next/link"
import { Check } from "lucide-react"
import { confirmGiftCardOrder } from "../lib/data/benefits"
import { formatMenuPrice } from "../lib/format-price"

/** Where Stripe sends the buyer back. The card is activated by reading the payment from Stripe, never from this URL. */
export async function GiftCardOrderPage({ searchParams }: { searchParams: Promise<{ id?: string; token?: string; result?: string }> }) {
  const { id, token, result } = await searchParams
  const order = id && token ? await confirmGiftCardOrder(id, token) : null
  const paid = order?.status === "completed" && order.code
  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-carton" data-band="ink" data-selected={paid ? "true" : undefined}>
          {paid ? <div className="sf-carton-band"><span className="sf-tick"><Check aria-hidden="true" /></span></div> : null}
          <div className="grid gap-3 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
            {paid ? (
              <>
                <h1 className="sf-display text-[length:var(--sf-text-3xl)]">Gift card ready</h1>
                <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{formatMenuPrice((order.amount || 0) / 100)} gift card. We emailed the code to {order.recipientEmail}.</p>
                <p className="sf-display font-mono text-[length:var(--sf-text-2xl)] tracking-wider">{order.code}</p>
              </>
            ) : (
              <>
                <h1 className="sf-display text-[length:var(--sf-text-3xl)]">{result === "cancelled" || order?.status === "cancelled" ? "Gift card not bought" : "Payment pending"}</h1>
                <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                  {order?.error || (result === "cancelled" || order?.status === "cancelled" ? "No charge was made." : "We have not received the payment yet. Refresh this page in a moment.")}
                </p>
              </>
            )}
          </div>
          <div className="sf-track border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)]">
            <Link href="/gift-cards" className="sf-btn sf-btn-primary">{paid ? "Buy another" : "Gift cards"}</Link>
            <Link href="/book" className="sf-btn sf-btn-quiet">Book an appointment</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
