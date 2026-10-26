import type { Metadata } from "next"
import Link from "next/link"
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
      <PageIntro title="Memberships & packages" description="Sold in the salon. Your plan appears in your account and applies at checkout." />
      {!benefits ? <p role="alert" className="sf-alert">Plans couldn&apos;t be loaded. Try again.</p>
        : memberships.length === 0 && packages.length === 0 ? (
          <div className="sf-carton sf-carton-empty mx-auto max-w-md" data-band="ink"><p className="sf-display text-[length:var(--sf-text-xl)]">No plans on offer right now</p><div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div></div>
        ) : (
          <div className="grid gap-[var(--sf-space-xl)]">
            {memberships.length ? (
              <section aria-labelledby="memberships">
                <h2 id="memberships" className="sf-display mb-3 border-b border-[var(--sf-ink)] pb-2 text-[length:var(--sf-text-2xl)]">Memberships</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {memberships.map((plan) => (
                    <article key={plan.id} className="sf-carton" data-band="1">
                      <div className="sf-carton-band"><span>Membership</span><span className="sf-shade" aria-hidden="true" /></div>
                      <div className="sf-carton-body">
                      <h3 className="sf-carton-name">{plan.name}</h3>
                      <p className="sf-num text-[length:var(--sf-text-2xl)]">{formatMenuPrice(plan.monthlyPrice / 100)}<small>/ month</small></p>
                      {plan.discountPercent ? <p className="text-[length:var(--sf-text-sm)] font-semibold">{plan.discountPercent}% off {plan.services.length ? plan.services.map((service) => service.name).join(", ") : "services"}</p> : null}
                      {plan.description ? <p className="sf-carton-desc">{plan.description}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            {packages.length ? (
              <section aria-labelledby="packages">
                <h2 id="packages" className="sf-display mb-3 border-b border-[var(--sf-ink)] pb-2 text-[length:var(--sf-text-2xl)]">Packages</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {packages.map((plan) => (
                    <article key={plan.id} className="sf-carton" data-band="2">
                      <div className="sf-carton-band"><span>Package</span><span className="sf-shade" aria-hidden="true" /></div>
                      <div className="sf-carton-body">
                      <h3 className="sf-carton-name">{plan.name}</h3>
                      <p className="sf-num text-[length:var(--sf-text-2xl)]">{formatMenuPrice(plan.totalPrice / 100)}</p>
                      <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{[plan.savingsAmount ? `Save ${formatMenuPrice(plan.savingsAmount / 100)}` : "", plan.validDays ? `valid ${plan.validDays} days` : "", plan.services.map((service) => service.name).join(", ")].filter(Boolean).join(", ")}</p>
                      {plan.description ? <p className="sf-carton-desc">{plan.description}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <div className="sf-track"><Link href="/contact" className="sf-btn sf-btn-primary">Ask about a plan</Link><Link href="/book" className="sf-btn sf-btn-quiet">Book an appointment</Link></div>
          </div>
        )}
    </div></div>
  )
}
