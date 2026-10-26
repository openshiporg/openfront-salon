import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { getCategoryBands, getServiceById } from "../lib/data/services"
import { categoryBand } from "../lib/bands"
import { StylistPortrait, stylistTitle, tierLabels } from "../components/StylistCard"
import { serviceTags } from "../components/ServiceCard"
import { getStorefrontImageSrc } from "../lib/images"
import { formatMenuPrice } from "../lib/format-price"
import { storefrontTitle } from "../lib/data/brand"

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const service = await getServiceById((await params).id)
  if (!service) return { title: await storefrontTitle("Page not found"), description: "Page not found" }
  return { title: await storefrontTitle(service.name), description: service.description || undefined }
}

export async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id } = await params
  const [service, bands] = await Promise.all([getServiceById(id), getCategoryBands()])

  if (!service) {
    notFound()
  }

  const tiers = service.pricingTier ? Object.entries(service.pricingTier) : []
  const specialists = service.specialists || []
  const imageSrc = getStorefrontImageSrc(service.image)
  const tags = serviceTags(service)

  return (
    <div className="sf-page-pad !pt-[var(--sf-space-sm)]">
      <div className="sf-container">
        <Link href="/services" className="sf-link inline-flex min-h-11 items-center gap-2 text-[length:var(--sf-text-sm)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Services
        </Link>

        <div className="mt-[var(--sf-space-sm)] grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">
            <header className="sf-carton" data-band={categoryBand(bands, service.category?.id)}>
              <div className="sf-carton-band !min-h-[4.5rem]">
                <span className="sf-shade" aria-hidden="true" />
              </div>
              {imageSrc ? (
                <div className="aspect-[16/9] overflow-hidden border-b border-[var(--sf-rule)] bg-[var(--sf-alu)]">
                  <img src={imageSrc} alt={service.image?.altText || service.name} className="h-full w-full object-cover" />
                </div>
              ) : null}
              <div className="sf-carton-body !gap-4 !p-[var(--sf-space-sm)] md:!p-[var(--sf-space-md)]">
                <div>
                  <h1 className="sf-display text-[length:var(--sf-text-display-s)]">{service.name}</h1>
                  {service.category?.name ? <p className="sf-carton-meta mt-2">{service.category.name}</p> : null}
                </div>
                {tags.length ? <div className="sf-carton-tags">{tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}</div> : null}
                {service.description ? <p className="max-w-[60ch] text-[length:var(--sf-text-lg)] leading-relaxed text-[var(--sf-ink-2)]">{service.description}</p> : null}
              </div>
            </header>

            {tiers.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="service-tiers">
                <h2 id="service-tiers" className="sf-display mb-3 border-b border-[var(--sf-ink)] pb-2 text-[length:var(--sf-text-2xl)]">Price by stylist level</h2>
                <dl>
                  {tiers.map(([tier, tierPrice]) => (
                    <div key={tier} className="sf-summary-row !text-[length:var(--sf-text-md)]">
                      <dt className="!text-[var(--sf-ink)]">{tierLabels[tier] || tier}</dt>
                      <dd className="sf-num">{formatMenuPrice(tierPrice as number)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {specialists.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="service-specialists">
                <h2 id="service-specialists" className="sf-display mb-3 border-b border-[var(--sf-ink)] pb-2 text-[length:var(--sf-text-2xl)]">Who does it</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {specialists.map((stylist) => (
                    <li key={stylist.id} className="sf-carton !flex-row items-center gap-3 p-2">
                      <StylistPortrait stylist={stylist} className="h-20 w-16 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/team/${stylist.id}`} className="sf-carton-name block truncate">{stylist.user?.name || "Stylist"}</Link>
                        <p className="text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">{stylistTitle(stylist.tier, stylist.role)}</p>
                      </div>
                      <Link href={`/book?service=${service.id}&stylist=${stylist.id}`} className="sf-btn sf-btn-sm shrink-0">Book</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="sf-tray-surface p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--sf-ink)] pb-3">
                <p className="sf-num text-[length:var(--sf-text-3xl)]">{service.baseDuration}<small>min</small></p>
                <p className="sf-num text-[length:var(--sf-text-xl)]">{tiers.length ? <small className="!ml-0 mr-1">from</small> : null}{formatMenuPrice(service.basePrice)}</p>
              </div>
              <dl className="py-1">
                {specialists.length ? <div className="sf-summary-row"><dt>Stylists</dt><dd>{specialists.length}</dd></div> : null}
                {tags.map((tag) => <div key={tag} className="sf-summary-row"><dt>Required</dt><dd>{tag}</dd></div>)}
              </dl>
              <div className="sf-track sf-track-block mt-3">
                <Link href={`/book?service=${service.id}`} className="sf-btn sf-btn-primary">Book this service</Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
