import { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, MapPin, Phone, Star } from "lucide-react"
import { getServicesGroupedByCategory, getFeaturedServices } from "../lib/data/services"
import { getAllStylists } from "../lib/data/stylists"
import { getApprovedReviews } from "../lib/data/reviews"
import { ServiceMenuRow } from "../components/ServiceCard"
import { StylistCard } from "../components/StylistCard"
import { getStorefrontBrand, storefrontDescription, storefrontTitle } from "../lib/data/brand"
import { formatMenuPrice } from "../lib/format-price"
import { bookableHours, openStatus, publishedHours } from "../lib/hours"

const PHOTOS = {
  interior: "/images/salon/interior.webp",
  color: "/images/salon/color-service.webp",
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle(),
    description: await storefrontDescription(),
  }
}

export async function HomePage() {
  const [categories, featuredServices, stylists, reviews, brand] = await Promise.all([
    getServicesGroupedByCategory(),
    getFeaturedServices(5),
    getAllStylists(),
    getApprovedReviews(),
    getStorefrontBrand(),
  ])

  const activeStylists = stylists.filter((stylist) => stylist.isActive)
  const serviceCount = categories.reduce((sum, category) => sum + (category.services?.length || 0), 0)
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null
  const status = openStatus(brand.hours, brand.timezone)
  const hours = publishedHours(brand.hours)
  const bookable = stylists.length ? bookableHours(stylists, "short") : null
  const quotes = reviews.filter((review) => review.comment).slice(0, 3)

  return (
    <div>
      <section className="sf-hero">
        <div className="sf-container sf-hero-grid">
          <div className="sf-hero-copy min-w-0">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {status ? (
                <span className="sf-status"><span className="sf-dot" data-tone={status.open ? "open" : undefined} aria-hidden="true" />{status.label}</span>
              ) : null}
              {brand.city ? <span className="sf-eyebrow">{[brand.city, brand.state].filter(Boolean).join(", ")}</span> : null}
            </div>
            <h1 className="sf-display sf-hero-title">
              {brand.name || <>Hair, color <em>&amp;</em> skin</>}
            </h1>
            {brand.description ? <p className="sf-lead">{brand.description}</p> : null}
            <div className="sf-hero-actions">
              <div className="sf-track">
                <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
                <Link href="/services" className="sf-btn sf-btn-quiet">Service menu</Link>
              </div>
            </div>
            {serviceCount || activeStylists.length || averageRating ? (
              <dl className="sf-hero-facts">
                {serviceCount ? <div><dt>Services</dt><dd><strong>{serviceCount}</strong></dd></div> : null}
                {activeStylists.length ? <div><dt>Stylists</dt><dd><strong>{activeStylists.length}</strong></dd></div> : null}
                {averageRating ? <div><dt>{reviews.length} reviews</dt><dd><strong>{averageRating.toFixed(1)} <span className="text-[var(--sf-accent)]">★</span></strong></dd></div> : null}
              </dl>
            ) : null}
          </div>

          <div className="sf-hero-media">
            <figure className="sf-arch">
              <img src={PHOTOS.interior} alt="Salon floor with mirrors and styling chairs" fetchPriority="high" />
            </figure>
            <figure className="sf-arch">
              <img src={PHOTOS.color} alt="Colorist painting dimensional color" loading="lazy" />
            </figure>
            <span className="sf-hero-badge" aria-hidden="true">
              <span className="sf-swatch-fan">{[1, 2, 3, 4, 5].map((swatch) => <span key={swatch} className="sf-swatch" data-swatch={swatch} />)}</span>
              Color bar
            </span>
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="sf-section !pt-[var(--sf-space-lg)]" aria-labelledby="home-categories">
          <div className="sf-container">
            <div className="sf-section-head">
              <h2 id="home-categories" className="sf-display sf-section-title">Book by <em>category</em></h2>
              <Link href="/services" className="sf-link text-[length:var(--sf-text-sm)]">Full menu</Link>
            </div>
            <div className="sf-category-grid">
              {categories.map((category, index) => {
                const prices = category.services.map((service) => service.basePrice)
                return (
                  <Link key={category.id} href={`/services#${category.id}`} className="sf-category-tile">
                    <span className="sf-swatch" data-swatch={(index % 6) + 1} aria-hidden="true" />
                    <span>
                      <h3>{category.name}</h3>
                      <p>{category.services.length} {category.services.length === 1 ? "service" : "services"}{prices.length ? ` · from ${formatMenuPrice(Math.min(...prices))}` : ""}</p>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {featuredServices.length > 0 ? (
        <section className="sf-section bg-[var(--sf-paper-2)]" aria-labelledby="home-services">
          <div className="sf-container grid gap-[var(--sf-space-lg)] lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <h2 id="home-services" className="sf-display sf-section-title">Most <em>booked</em></h2>
              <div className="sf-track mt-6">
                <Link href="/services" className="sf-btn">See all services</Link>
              </div>
            </div>
            <div className="sf-menu">
              {featuredServices.map((service) => <ServiceMenuRow key={service.id} service={service} showCategory />)}
            </div>
          </div>
        </section>
      ) : null}

      {activeStylists.length > 0 ? (
        <section className="sf-section" aria-labelledby="home-artists">
          <div className="sf-container">
            <div className="sf-section-head">
              <h2 id="home-artists" className="sf-display sf-section-title">Choose your <em>stylist</em></h2>
              <Link href="/team" className="sf-link text-[length:var(--sf-text-sm)]">All stylists</Link>
            </div>
            <div className="sf-artist-rail">
              {activeStylists.slice(0, 4).map((stylist) => <StylistCard key={stylist.id} stylist={stylist} />)}
            </div>
          </div>
        </section>
      ) : null}

      {averageRating && quotes.length > 0 ? (
        <section className="sf-section bg-[var(--sf-paper-2)]" aria-labelledby="home-reviews">
          <div className="sf-container">
            <div className="sf-section-head">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <h2 id="home-reviews" className="sf-display sf-section-title">{averageRating.toFixed(1)} <em>★</em></h2>
                <p className="pb-2 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{reviews.length} client {reviews.length === 1 ? "review" : "reviews"}</p>
              </div>
              <Link href="/reviews" className="sf-link text-[length:var(--sf-text-sm)]">Read reviews</Link>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {quotes.map((review) => (
                <li key={review.id} className="sf-card flex flex-col gap-5 p-[var(--sf-space-md)]">
                  <span className="sf-stars" aria-label={`${review.rating} out of 5 stars`}>{[0, 1, 2, 3, 4].map((index) => <Star key={index} className={index < review.rating ? "fill-current" : "opacity-25"} aria-hidden="true" />)}</span>
                  <blockquote className="sf-quote line-clamp-5 flex-1">&ldquo;{review.comment}&rdquo;</blockquote>
                  <p className="text-[length:var(--sf-text-sm)]"><span className="font-semibold">{review.reviewerName || "Client"}</span>{review.service?.name ? <span className="text-[var(--sf-ink-3)]"> · {review.service.name}</span> : null}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {brand.configured && (brand.addressLine || hours.length > 0) ? (
        <section className="sf-section" aria-labelledby="home-visit">
          <div className="sf-container grid gap-[var(--sf-space-lg)] lg:grid-cols-2 lg:items-start">
            <div>
              <h2 id="home-visit" className="sf-display sf-section-title">Visit</h2>
              {brand.addressLine ? (
                <p className="mt-6 flex gap-3 text-[length:var(--sf-text-md)] leading-relaxed">
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-[var(--sf-accent)]" aria-hidden="true" />
                  <span>{brand.locationName ? <><span className="font-semibold">{brand.locationName}</span><br /></> : null}{brand.addressLine}</span>
                </p>
              ) : null}
              {brand.phone && brand.phoneHref ? (
                <p className="mt-3 flex gap-3 text-[length:var(--sf-text-md)]"><Phone className="mt-1 h-5 w-5 shrink-0 text-[var(--sf-accent)]" aria-hidden="true" /><a href={brand.phoneHref} className="sf-link">{brand.phone}</a></p>
              ) : null}
              <div className="sf-track mt-8">
                <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
                {brand.addressLine ? <a href={`https://maps.google.com/?q=${encodeURIComponent(brand.addressLine)}`} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-quiet">Directions<ArrowUpRight /></a> : null}
              </div>
            </div>
            {hours.length > 0 ? (
              <div className="sf-card p-[var(--sf-space-md)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Hours</h3>
                  {status ? <span className="sf-status !text-[length:var(--sf-text-xs)]"><span className="sf-dot" data-tone={status.open ? "open" : undefined} aria-hidden="true" />{status.label}</span> : null}
                </div>
                <dl className="divide-y divide-[var(--sf-rule)]">
                  {hours.map((day) => (
                    <div key={day.key} className={`flex justify-between gap-4 py-2.5 text-[length:var(--sf-text-sm)] ${day.key === status?.todayKey ? "font-semibold text-[var(--sf-ink)]" : "text-[var(--sf-ink-2)]"}`}>
                      <dt>{day.day}{day.key === status?.todayKey ? <span className="ml-2 text-[length:var(--sf-text-xs)] text-[var(--sf-accent)]">Today</span> : null}</dt>
                      <dd className="text-right tabular-nums">{day.hours}{bookable && !day.closed && bookable[day.key] === "No appointments" ? <span className="block text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">No appointments</span> : null}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
