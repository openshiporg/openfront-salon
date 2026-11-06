import Link from "next/link"
import { Check } from "lucide-react"
import { confirmMembershipSignup } from "../lib/data/benefits"
import { formatMenuPrice } from "../lib/format-price"

/** Where Stripe sends a new member back. The membership is created from Stripe's subscription, never from this URL. */
export async function MembershipJoinedPage({ searchParams }: { searchParams: Promise<{ id?: string; token?: string; result?: string }> }) {
  const { id, token, result } = await searchParams
  const signup = id && token ? await confirmMembershipSignup(id, token) : null
  const joined = signup?.status === "completed"
  const cancelled = result === "cancelled" || signup?.status === "cancelled"
  const next = signup?.nextBillingDate ? new Date(signup.nextBillingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null
  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-carton" data-band="ink" data-selected={joined ? "true" : undefined}>
          {joined ? <div className="sf-carton-band"><span className="sf-tick"><Check aria-hidden="true" /></span></div> : null}
          <div className="grid gap-3 p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
            <h1 className="sf-display text-[length:var(--sf-text-3xl)]">{joined ? `Welcome to ${signup.planName}` : cancelled ? "Membership not started" : "Payment pending"}</h1>
            <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">
              {joined
                ? `${formatMenuPrice((signup.amount || 0) / 100)} a month${next ? `, next billed ${next}` : ""}. Your member pricing applies at checkout from today.`
                : signup?.error || (cancelled ? "No charge was made." : "We have not received the first payment yet. Refresh this page in a moment.")}
            </p>
          </div>
          <div className="sf-track border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)]">
            <Link href={joined ? "/book" : "/memberships"} className="sf-btn sf-btn-primary">{joined ? "Book an appointment" : "Memberships"}</Link>
            <Link href="/account" className="sf-btn sf-btn-quiet">Your account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
