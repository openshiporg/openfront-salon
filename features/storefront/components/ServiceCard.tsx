import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
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

/**
 * A colour-tube carton: a band in the category's shade across the top (colour only,
 * plus the shade chip's literal code), a window onto the service photo, the name in
 * condensed caps, duration and price in wide numerals, and a Book control.
 * `meta` is a small line under the name (the category, on mixed walls).
 */
export function ServiceCarton({
  service,
  band = "1",
  code,
  meta,
  showImage = true,
  showDescription = false,
  bookHref,
}: {
  service: Service
  band?: string
  code?: string | null
  meta?: string | null
  showImage?: boolean
  showDescription?: boolean
  bookHref?: string
}) {
  const tags = serviceTags(service)
  const imageSrc = showImage ? getStorefrontImageSrc(service.image) : null
  return (
    <article className="sf-carton" data-band={band}>
      <div className="sf-carton-band">
        <span className="sf-shade" aria-hidden="true">{code || null}</span>
      </div>
      {imageSrc ? (
        <div className="sf-carton-window">
          <img src={imageSrc} alt={service.image?.altText || ""} loading="lazy" />
        </div>
      ) : null}
      <div className="sf-carton-body">
        <h3><Link href={`/services/${service.id}`} className="sf-carton-name">{service.name}</Link></h3>
        {meta ? <p className="sf-carton-meta">{meta}</p> : null}
        {showDescription && service.description ? <p className="sf-carton-desc line-clamp-3">{service.description}</p> : null}
        {tags.length ? (
          <div className="sf-carton-tags">
            {tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}
          </div>
        ) : null}
        <p className="sf-carton-figures">
          <span className="sf-num sf-carton-duration">{service.baseDuration}<small>min</small></span>
          <span className="sf-num sf-carton-price">{hasTiers(service) ? <small>from</small> : null}{formatMenuPrice(service.basePrice)}</span>
        </p>
      </div>
      <Link href={bookHref || `/book?service=${service.id}`} className="sf-carton-action" aria-label={`Book ${service.name}`}>
        Book
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  )
}

/** Kept for existing imports: the carton is the storefront's service card. */
export function ServiceCard({ service }: { service: Service; showCategory?: boolean }) {
  return <ServiceCarton service={service} />
}
