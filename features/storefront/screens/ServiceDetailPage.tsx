import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Clock, AlertCircle } from "lucide-react"
import { getServiceById } from "../lib/data/services"
import { StylistCard } from "../components/StylistCard"
import { getStorefrontImageSrc } from "../lib/images"
import { getStorefrontBrand } from "../lib/data/brand"
import { formatPrice } from "../lib/format-price"

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>
}

export async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id } = await params
  const [service, brand] = await Promise.all([getServiceById(id), getStorefrontBrand()])

  if (!service) {
    notFound()
  }

  const price = service.basePrice
  const duration = service.baseDuration
  const hasPricingTiers = service.pricingTier && Object.keys(service.pricingTier).length > 0
  const hasSpecialists = service.specialists && service.specialists.length > 0
  const imageSrc = getStorefrontImageSrc(service.image)

  return (
    <div>
      <div className="border-b border-[var(--sf-rule)] sticky top-[4.25rem] z-10 bg-[color-mix(in_oklch,var(--sf-paper)_92%,transparent)] backdrop-blur-md">
        <div className="sf-container py-3">
          <Link href="/services" className="sf-link inline-flex items-center gap-2 text-[var(--sf-text-sm)]">
            <ArrowLeft className="h-4 w-4" />
            Service menu
          </Link>
        </div>
      </div>

      <div className="sf-container sf-page-pad">
        <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.75fr)]">
          <div className="min-w-0 space-y-[var(--sf-space-lg)]">
            {imageSrc ? (
              <div className="aspect-[16/10] overflow-hidden border border-[var(--sf-rule)]">
                <img
                  src={imageSrc}
                  alt={service.image?.altText || service.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <header>
              {service.category ? (
                <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] mb-2">{service.category.name}</p>
              ) : null}
              <h1 className="sf-display text-[var(--sf-text-display-s)] mb-4">{service.name}</h1>
              <div className="flex flex-wrap gap-6 text-[var(--sf-text-sm)]">
                <span className="inline-flex items-center gap-2 text-[var(--sf-ink-2)]">
                  <Clock className="h-4 w-4" />
                  {duration} minutes
                </span>
                <span className="font-medium text-[var(--sf-ink)]">{formatPrice(price)}</span>
              </div>
            </header>

            {service.description ? (
              <div>
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-3">About this service</h2>
                <p className="text-[var(--sf-text-md)] text-[var(--sf-ink-2)] leading-relaxed max-w-prose">
                  {service.description}
                </p>
              </div>
            ) : null}

            {hasPricingTiers ? (
              <div>
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-4">Pricing by tier</h2>
                <ul className="divide-y divide-[var(--sf-rule)] border-y border-[var(--sf-rule)]">
                  {Object.entries(service.pricingTier!).map(([tier, tierPrice]) => (
                    <li key={tier} className="flex items-center justify-between py-3 text-[var(--sf-text-sm)]">
                      <span className="capitalize text-[var(--sf-ink-2)]">{tier} artist</span>
                      <span className="font-medium text-[var(--sf-ink)]">{formatPrice(tierPrice as number)}</span>
                    </li>
                  ))}
                </ul>
                <p role="note" className="mt-3 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] leading-relaxed">
                  Price shown is the starting price.
                </p>
              </div>
            ) : null}

            {(service.requiresConsultation || service.requiresPatchTest) && (
              <div className="border border-[color-mix(in_oklch,var(--sf-accent)_35%,var(--sf-rule))] bg-[var(--sf-accent-soft)] p-[var(--sf-space-md)]">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
                  <div className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                    <p className="font-medium text-[var(--sf-ink)] mb-2">Before you book</p>
                    <ul className="space-y-1">
                      {service.requiresConsultation ? <li>Consultation required before first visit</li> : null}
                      {service.requiresPatchTest ? <li>Patch test 24–48 hours before service</li> : null}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {hasSpecialists ? (
              <div>
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-4">Specialists for this service</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {service.specialists.map((stylist) => (
                    <StylistCard
                      key={stylist.id}
                      stylist={stylist}
                      variant="compact"
                      showSpecializations={false}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="sf-card p-[var(--sf-space-md)]">
              <h2 className="sf-display text-[var(--sf-text-xl)] mb-6">Reserve</h2>
              <dl className="space-y-3 text-[var(--sf-text-sm)] mb-6">
                <div className="flex justify-between gap-4 border-b border-[var(--sf-rule)] pb-3">
                  <dt className="text-[var(--sf-ink-3)]">Duration</dt>
                  <dd className="font-medium">{duration} min</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--sf-rule)] pb-3">
                  <dt className="text-[var(--sf-ink-3)]">From</dt>
                  <dd className="font-medium">{formatPrice(price)}</dd>
                </div>
                {hasSpecialists ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--sf-ink-3)]">Specialists</dt>
                    <dd className="font-medium">{service.specialists.length}</dd>
                  </div>
                ) : null}
              </dl>

              <Link href={`/book?service=${service.id}`} className="sf-btn sf-btn-primary w-full mb-3">
                <Calendar className="h-4 w-4" />
                Reserve this service
              </Link>

              {hasSpecialists ? (
                <Link href="/team" className="sf-btn sf-btn-secondary w-full">
                  View all artists
                </Link>
              ) : null}


            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
