import { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Star } from "lucide-react"
import { getCategoryBands, getServicesGroupedByCategory } from "../lib/data/services"
import { getAllStylists } from "../lib/data/stylists"
import { getApprovedReviews } from "../lib/data/reviews"
import { ServiceCarton } from "../components/ServiceCard"
import { categoryBand, serviceCodes } from "../lib/bands"
import { getStorefrontImageSrc } from "../lib/images"
import { StylistCard, serviceCategoryIndex } from "../components/StylistCard"
import { getStorefrontBrand, storefrontDescription, storefrontTitle } from "../lib/data/brand"
import { bookableHours, openStatus, publishedHours } from "../lib/hours"

const INTERIOR = "/images/salon/interior.webp"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle(),
    description: await storefrontDescription(),
  }
}

export async function HomePage() {
  const [categories, stylists, reviews, brand, bands] = await Promise.all([
    getServicesGroupedByCategory(),
    getAllStylists(),
    getApprovedReviews(),
    getStorefrontBrand(),
    getCategoryBands(),
  ])

  const activeStylists = stylists.filter((stylist) => stylist.isActive)
  // Each carton keeps its category's shade; a photo already on the wall is not shown twice.
  const seenPhotos = new Set<string>([INTERIOR])
  const cartons = categories.flatMap((category) => {
    const codes = serviceCodes(category.services.map((service) => ({ id: service.id, category: { id: category.id, name: category.name } })))
    return category.services.map((service) => {
      const src = getStorefrontImageSrc(service.image)
      const showImage = Boolean(src && !seenPhotos.has(src))
      if (src) seenPhotos.add(src)
      return { service, band: categoryBand(bands, category.id), code: codes.get(service.id), label: category.name, showImage }
    })
  })
  const serviceIndex = serviceCategoryIndex(categories.flatMap((category) => category.services.map((service) => ({ id: service.id, category: { id: category.id } }))))
  const legend = categories.map((category) => ({ id: category.id, name: category.name, band: categoryBand(bands, category.id) }))
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null
  const status = openStatus(brand.hours, brand.timezone, new Date(), stylists)
  const hours = publishedHours(brand.hours)
  const bookable = stylists.length ? bookableHours(stylists, "short") : null
  const quotes = reviews.filter((review) => review.comment).slice(0, 3)
  const mapsHref = brand.addressLine ? `https://maps.google.com/?q=${encodeURIComponent(brand.addressLine)}` : null

  return (
    <div>
      <section className="sf-nameband" aria-labelledby="home-name">
        <div className="sf-container">
          <h1 id="home-name" className="sf-display sf-nameband-name">{brand.name || "Book a visit"}</h1>
          <div className="sf-nameband-meta">
            <div className="sf-nameband-facts">
              {status ? <span className="sf-status"><span className="sf-dot" data-tone={status.open ? "open" : undefined} aria-hidden="true" />{status.label}</span> : null}
              {brand.addressLine ? <span className="text-[var(--sf-ink-2)]">{brand.addressLine}</span> : null}
            </div>
            <Link href="/book" className="sf-btn sf-btn-primary">Book</Link>
          </div>
        </div>
      </section>

      <section className="pb-[var(--sf-space-xl)]" aria-label="Services">
        <div className="sf-container">
          <div className="sf-wall">
            <figure className="sf-wall-photo">
              <img src={INTERIOR} alt={brand.name ? `Inside ${brand.name}` : "Inside the salon"} fetchPriority="high" />
              {brand.locationName ? <figcaption>{brand.locationName}</figcaption> : null}
            </figure>
            {cartons.length > 0 ? cartons.map(({ service, band, code, label, showImage }) => (
              <ServiceCarton key={service.id} service={service} band={band} code={code} meta={legend.length > 1 ? label : null} showImage={showImage} />
            )) : (
              <article className="sf-carton sf-carton-empty" data-band="ink">
                <h2 className="sf-display text-[length:var(--sf-text-xl)]">No services listed yet</h2>
                <div className="sf-track"><Link href="/contact" className="sf-btn">Contact the salon</Link></div>
              </article>
            )}
          </div>
          {cartons.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              {legend.length > 1 ? (
                <ul className="sf-legend" aria-label="Category colours">
                  {legend.map((item) => <li key={item.id} data-band={item.band}><span className="sf-shade" aria-hidden="true" />{item.name}</li>)}
                </ul>
              ) : <span />}
              <Link href="/services" className="sf-link text-[length:var(--sf-text-sm)]">Services by category</Link>
            </div>
          ) : null}
        </div>
      </section>

      {activeStylists.length > 0 ? (
        <section className="sf-shelf" data-ground="alu" aria-labelledby="home-stylists">
          <div className="sf-container">
            <div className="sf-section-head">
              <h2 id="home-stylists" className="sf-display sf-section-title">Stylists</h2>
              <Link href="/team" className="sf-link text-[length:var(--sf-text-sm)]">All stylists</Link>
            </div>
            <div className="sf-shelf-grid" data-cols="4">
              {activeStylists.slice(0, 4).map((stylist) => <StylistCard key={stylist.id} stylist={stylist} bands={bands} serviceIndex={serviceIndex} />)}
            </div>
          </div>
        </section>
      ) : null}

      {averageRating && quotes.length > 0 ? (
        <section className="sf-shelf" aria-labelledby="home-reviews">
          <div className="sf-container">
            <div className="sf-section-head">
              <h2 id="home-reviews" className="sf-display sf-section-title">Reviews</h2>
              <p className="flex items-baseline gap-3">
                <span className="sf-num text-[length:var(--sf-text-2xl)]">{averageRating.toFixed(1)}</span>
                <span className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">from {reviews.length} client {reviews.length === 1 ? "review" : "reviews"}</span>
                <Link href="/reviews" className="sf-link text-[length:var(--sf-text-sm)]">Read all</Link>
              </p>
            </div>
            <ul className="sf-shelf-grid" data-cols="1-2-3">
              {quotes.map((review) => (
                <li key={review.id} className="sf-carton" data-band="ink">
                  <div className="sf-carton-body gap-4 !p-[var(--sf-space-sm)]">
                    <span className="sf-stars" aria-label={`${review.rating} out of 5 stars`}>{[0, 1, 2, 3, 4].map((index) => <Star key={index} className={index < review.rating ? "fill-current" : "opacity-25"} aria-hidden="true" />)}</span>
                    <blockquote className="sf-quote line-clamp-4">{review.comment}</blockquote>
                    <p className="mt-auto text-[length:var(--sf-text-sm)]"><span className="font-semibold">{review.reviewerName || "Client"}</span>{review.service?.name ? <span className="text-[var(--sf-ink-3)]">, {review.service.name}</span> : null}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {brand.configured && (brand.addressLine || hours.length > 0) ? (
        <section className={`sf-shelf ${averageRating && quotes.length > 0 ? "!pt-0" : ""}`} aria-labelledby="home-visit">
          <div className="sf-container">
            <div className="sf-section-head">
              <h2 id="home-visit" className="sf-display sf-section-title">Hours &amp; address</h2>
            </div>
            <div className="grid gap-[var(--sf-space-md)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="grid content-start gap-3 text-[length:var(--sf-text-md)]">
                {brand.addressLine ? <p className="leading-relaxed">{brand.locationName ? <><span className="font-semibold">{brand.locationName}</span><br /></> : null}{brand.addressLine}</p> : null}
                {brand.phone && brand.phoneHref ? <p><a href={brand.phoneHref} className="sf-link">{brand.phone}</a></p> : null}
                {mapsHref ? <div className="sf-track mt-2"><a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-quiet">Directions<ArrowUpRight /></a></div> : null}
              </div>
              {hours.length > 0 ? (
                <dl className="sf-tray-surface px-[var(--sf-space-sm)] py-1">
                  {hours.map((day) => {
                    const isToday = day.key === status?.todayKey
                    return (
                      <div key={day.key} className={`sf-summary-row ${isToday ? "!font-semibold" : ""}`}>
                        <dt className={isToday ? "!text-[var(--sf-ink)]" : ""}>{day.day}{isToday ? " (today)" : ""}</dt>
                        <dd className="tabular-nums">{day.hours}{bookable && !day.closed && bookable[day.key] === "No appointments" ? <span className="block text-[length:var(--sf-text-xs)] font-normal text-[var(--sf-ink-3)]">No appointments</span> : null}</dd>
                      </div>
                    )
                  })}
                </dl>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
