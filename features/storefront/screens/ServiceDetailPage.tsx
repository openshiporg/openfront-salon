import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react"
import { getServiceById } from "../lib/data/services"
import { StylistPortrait, tierLabels } from "../components/StylistCard"
import { serviceTags } from "../components/ServiceCard"
import { getStorefrontImageSrc } from "../lib/images"
import { formatMenuPrice } from "../lib/format-price"
import { storefrontTitle } from "../lib/data/brand"

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const service = await getServiceById((await params).id)
  return { title: await storefrontTitle(service?.name || "Service"), description: service?.description || undefined }
}

export async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id } = await params
  const service = await getServiceById(id)

  if (!service) {
    notFound()
  }

  const tiers = service.pricingTier ? Object.entries(service.pricingTier) : []
  const specialists = service.specialists || []
  const imageSrc = getStorefrontImageSrc(service.image)
  const tags = serviceTags(service)

  return (
    <div className="sf-page-pad !pt-[var(--sf-space-md)]">
      <div className="sf-container">
        <Link href="/services" className="sf-link inline-flex min-h-11 items-center gap-2 text-[length:var(--sf-text-sm)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Service menu
        </Link>

        <div className="mt-[var(--sf-space-md)] grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <header>
              {service.category ? <p className="sf-eyebrow mb-4">{service.category.name}</p> : null}
              <h1 className="sf-display text-[length:var(--sf-text-display-s)]">{service.name}</h1>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="sf-chip"><Clock3 aria-hidden="true" />{service.baseDuration} min</span>
                {tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}
              </div>
            </header>

            {imageSrc ? (
              <div className="sf-media mt-[var(--sf-space-lg)] aspect-[16/10]">
                <img src={imageSrc} alt={service.image?.altText || service.name} />
              </div>
            ) : null}

            {service.description ? (
              <p className="mt-[var(--sf-space-lg)] max-w-[60ch] text-[length:var(--sf-text-lg)] leading-relaxed text-[var(--sf-ink-2)]">{service.description}</p>
            ) : null}

            {tiers.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="service-tiers">
                <h2 id="service-tiers" className="sf-display mb-4 text-[length:var(--sf-text-2xl)]">Price by stylist level</h2>
                <dl className="sf-menu">
                  {tiers.map(([tier, tierPrice]) => (
                    <div key={tier} className="flex items-baseline gap-3 border-b border-[var(--sf-rule)] py-3.5">
                      <dt className="text-[length:var(--sf-text-md)]">{tierLabels[tier] || tier}</dt>
                      <span className="sf-menu-leader" aria-hidden="true" />
                      <dd className="sf-menu-price">{formatMenuPrice(tierPrice as number)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {specialists.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="service-specialists">
                <h2 id="service-specialists" className="sf-display mb-5 text-[length:var(--sf-text-2xl)]">Who does it</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {specialists.map((stylist) => (
                    <li key={stylist.id} className="sf-card flex items-center gap-4 p-3">
                      <StylistPortrait stylist={stylist} className="h-20 w-16 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/team/${stylist.id}`} className="sf-display block truncate text-[length:var(--sf-text-lg)] hover:text-[var(--sf-accent)]">{stylist.user?.name || "Stylist"}</Link>
                        {stylist.tier ? <p className="text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">{tierLabels[stylist.tier] || stylist.tier}</p> : null}
                        <div className="sf-track mt-2">
                          <Link href={`/book?service=${service.id}&stylist=${stylist.id}`} className="sf-btn sf-btn-sm">Book</Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="sf-ticket">
              <div className="p-[var(--sf-space-md)]">
                <p className="sf-eyebrow">{tiers.length ? "From" : "Price"}</p>
                <p className="sf-display mt-2 text-[length:var(--sf-text-3xl)]">{formatMenuPrice(service.basePrice)}</p>
              </div>
              <div className="sf-ticket-perf" />
              <dl className="px-[var(--sf-space-md)] py-2">
                <div className="sf-summary-row"><dt>Duration</dt><dd>{service.baseDuration} min</dd></div>
                {specialists.length ? <div className="sf-summary-row"><dt>Stylists</dt><dd>{specialists.length}</dd></div> : null}
                {tags.map((tag) => <div key={tag} className="sf-summary-row"><dt>Required</dt><dd>{tag}</dd></div>)}
              </dl>
              <div className="px-[var(--sf-space-md)] pb-[var(--sf-space-md)]">
                <div className="sf-track sf-track-block">
                  <Link href={`/book?service=${service.id}`} className="sf-btn sf-btn-primary">Book this service</Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
