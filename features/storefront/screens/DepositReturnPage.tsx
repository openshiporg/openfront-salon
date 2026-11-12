import Link from "next/link"
import { notFound } from "next/navigation"
import { Check } from "lucide-react"
import { confirmDepositCheckout } from "../lib/data/deposits"
import { PayDepositButton } from "../components/PayDepositButton"

interface Props {
  searchParams: Promise<{ id?: string; token?: string; result?: string }>
}

/** Where Stripe Checkout sends the guest back. The deposit is confirmed by reading the Checkout from Stripe, not from this URL. */
export async function DepositReturnPage({ searchParams }: Props) {
  const { id, token, result } = await searchParams
  if (!id) notFound()
  const status = await confirmDepositCheckout(id, token || null)
  if (!status.ok && status.error === "Appointment not found") notFound()
  if (status.status === "refunded" || status.status === "cancelled") {
    return (
      <Message
        title={status.status === "refunded" ? "Deposit refunded" : "Booking cancelled"}
        body={status.status === "refunded" ? "This booking was cancelled and the deposit was refunded to your card." : "This booking was cancelled. No deposit is due."}
      />
    )
  }
  if (status.paid) {
    return (
      <div className="sf-page-pad">
        <div className="sf-container-narrow">
          <div className="sf-carton" data-band="ink" data-selected="true">
            <div className="sf-carton-band"><span className="sf-tick"><Check aria-hidden="true" /></span></div>
            <div className="px-[var(--sf-space-sm)] pb-3 pt-[var(--sf-space-sm)] md:px-[var(--sf-space-md)]">
              <h1 className="sf-display text-[length:var(--sf-text-3xl)]">Deposit paid</h1>
              <p className="mt-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Your time is held. The deposit comes off your total at checkout.</p>
            </div>
            <div className="sf-track border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)]">
              <Link href="/" className="sf-btn sf-btn-primary">Home</Link>
              <Link href="/book" className="sf-btn sf-btn-quiet">Book another</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }
  const cancelled = result === "cancelled"
  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-carton" data-band="ink">
          <div className="grid gap-3 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
            <h1 className="sf-display text-[length:var(--sf-text-3xl)]">{cancelled ? "Deposit not paid" : "Deposit pending"}</h1>
            <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">
              {status.error || (cancelled ? "No charge was made. You can pay the deposit now or at the salon." : "We have not received the deposit yet. This page updates when your card payment is confirmed.")}
            </p>
            {token ? <PayDepositButton appointmentId={id} accessToken={token} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="sf-page-pad"><div className="sf-container-narrow"><h1 className="sf-display text-[length:var(--sf-text-3xl)]">{title}</h1><p className="mt-3 text-[length:var(--sf-text-sm)]">{body}</p></div></div>
  )
}
