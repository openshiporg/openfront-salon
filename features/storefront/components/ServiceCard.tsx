import Link from "next/link"
import { Clock3, ShieldCheck } from "lucide-react"
import { Service } from "../lib/data/services"
import { getStorefrontImageSrc } from "../lib/images"
import { formatMenuPrice } from "../lib/format-price"

export function serviceTags(service: Pick<Service, "requiresConsultation" | "requiresPatchTest">) {
  return [
    service.requiresConsultation ? "Consultation first" : null,
    service.requiresPatchTest ? "Patch test 24–48h before" : null,
  ].filter((tag): tag is string => Boolean(tag))
}

function hasTiers(service: Service) {
  return Boolean(service.pricingTier && Object.keys(service.pricingTier).length > 0)
}

/** A printed-menu line: name, dotted leader, price, then duration and requirements. */
export function ServiceMenuRow({ service, showCategory = false, bookHref }: { service: Service; showCategory?: boolean; bookHref?: string }) {
  const tags = serviceTags(service)
  return (
    <article className="sf-menu-row">
      <div className="min-w-0">
        {showCategory && service.category ? <p className="sf-eyebrow mb-1.5">{service.category.name}</p> : null}
        <div className="sf-menu-name">
          <Link href={`/services/${service.id}`}>{service.name}</Link>
          <span className="sf-menu-leader hidden sm:block" aria-hidden="true" />
        </div>
        {service.description ? <p className="sf-menu-desc line-clamp-2">{service.description}</p> : null}
        <div className="sf-menu-meta">
          <span className="sf-chip"><Clock3 aria-hidden="true" />{service.baseDuration} min</span>
          {tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}
        </div>
      </div>
      <p className="sf-menu-price">
        {hasTiers(service) ? <small>from</small> : null}
        {formatMenuPrice(service.basePrice)}
      </p>
      <div className="sf-menu-action">
        <div className="sf-track">
          <Link href={bookHref || `/book?service=${service.id}`} className="sf-btn sf-btn-sm">Book</Link>
        </div>
      </div>
    </article>
  )
}

/** Image card used where a service is shown as a feature. */
export function ServiceCard({ service, showCategory = false }: { service: Service; showCategory?: boolean }) {
  const imageSrc = getStorefrontImageSrc(service.image)
  return (
    <Link href={`/services/${service.id}`} className="group flex flex-col">
      <div className="sf-media aspect-[4/3]">
        {imageSrc ? <img src={imageSrc} alt={service.image?.altText || service.name} loading="lazy" /> : <div className="sf-arch-placeholder" aria-hidden="true">{service.name.charAt(0)}</div>}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {showCategory && service.category ? <p className="sf-eyebrow mb-1">{service.category.name}</p> : null}
          <h3 className="sf-display text-[length:var(--sf-text-xl)] group-hover:text-[var(--sf-accent)]">{service.name}</h3>
        </div>
        <p className="sf-menu-price shrink-0">{formatMenuPrice(service.basePrice)}</p>
      </div>
      <p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{service.baseDuration} min</p>
    </Link>
  )
}
