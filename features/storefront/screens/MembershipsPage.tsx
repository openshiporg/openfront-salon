import type { Metadata } from "next"
import Link from "next/link"
import { Package, Sparkles } from "lucide-react"
import { PageIntro } from "../components/ui/PageIntro"
import { storefrontTitle } from "../lib/data/brand"
import { getStorefrontBenefits } from "../lib/data/benefits"
import { formatMenuPrice } from "../lib/format-price"

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Memberships & packages") }
}

export async function MembershipsPage() {
  const benefits = await getStorefrontBenefits()
  const memberships = benefits?.memberships || []
  const packages = benefits?.packages || []

  return (
    <div className="sf-page-pad"><div className="sf-container">
      <PageIntro title={<>Memberships <em>&amp;</em> packages</>} size="large" />
      {!benefits ? <p role="alert" className="sf-alert">Plans couldn&apos;t be loaded. Try again.</p>
        : memberships.length === 0 && packages.length === 0 ? (
          <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-xl)] text-center"><p className="sf-display mb-5 text-[length:var(--sf-text-xl)]">No plans on offer right now</p><div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div></div>
        ) : (
          <div className="grid gap-[var(--sf-space-xl)]">
            {memberships.length ? (
              <section aria-labelledby="memberships">
                <h2 id="memberships" className="sf-display mb-5 flex items-center gap-3 text-[length:var(--sf-text-2xl)]"><Sparkles className="h-5 w-5 text-[var(--sf-accent)]" aria-hidden="true" />Memberships</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {memberships.map((plan) => (
                    <article key={plan.id} className="sf-card grid content-start gap-3 p-[var(--sf-space-md)]">
                      <h3 className="sf-display text-[length:var(--sf-text-xl)]">{plan.name}</h3>
                      <p className="text-[length:var(--sf-text-2xl)] font-semibold tabular-nums">{formatMenuPrice(plan.monthlyPrice / 100)}<span className="text-[length:var(--sf-text-sm)] font-normal text-[var(--sf-ink-3)]"> / month</span></p>
                      {plan.discountPercent ? <p className="text-[length:var(--sf-text-sm)] font-medium text-[var(--sf-accent-deep)]">{plan.discountPercent}% off {plan.services.length ? plan.services.map((service) => service.name).join(", ") : "services"}</p> : null}
                      {plan.description ? <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{plan.description}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {packages.length ? (
              <section aria-labelledby="packages">
                <h2 id="packages" className="sf-display mb-5 flex items-center gap-3 text-[length:var(--sf-text-2xl)]"><Package className="h-5 w-5 text-[var(--sf-accent)]" aria-hidden="true" />Packages</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {packages.map((plan) => (
                    <article key={plan.id} className="sf-card grid content-start gap-3 p-[var(--sf-space-md)]">
                      <h3 className="sf-display text-[length:var(--sf-text-xl)]">{plan.name}</h3>
                      <p className="text-[length:var(--sf-text-2xl)] font-semibold tabular-nums">{formatMenuPrice(plan.totalPrice / 100)}</p>
                      <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{[plan.savingsAmount ? `Save ${formatMenuPrice(plan.savingsAmount / 100)}` : "", plan.validDays ? `valid ${plan.validDays} days` : "", plan.services.map((service) => service.name).join(", ")].filter(Boolean).join(" · ")}</p>
                      {plan.description ? <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{plan.description}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="sf-ticket max-w-2xl overflow-hidden">
              <div className="p-[var(--sf-space-md)] md:p-[var(--sf-space-lg)]"><h2 className="sf-display text-[length:var(--sf-text-xl)]">Sold in the salon</h2><p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Your plan appears in your account and applies at checkout.</p></div>
              <div className="sf-ticket-perf" />
              <div className="p-[var(--sf-space-md)] md:px-[var(--sf-space-lg)]"><div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link><Link href="/contact" className="sf-btn sf-btn-quiet">Contact the salon</Link></div></div>
            </section>
          </div>
        )}
    </div></div>
  )
}
