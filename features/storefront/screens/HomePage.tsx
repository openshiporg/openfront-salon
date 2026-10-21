import { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Clock3 } from "lucide-react"
import { getServicesGroupedByCategory, getFeaturedServices } from "../lib/data/services"
import { getAllStylists } from "../lib/data/stylists"
import { ServiceCard } from "../components/ServiceCard"
import { StylistCard } from "../components/StylistCard"
import { getStorefrontBrand, storefrontDescription, storefrontTitle } from "../lib/data/brand"
import { formatPrice } from "../lib/format-price"

const EDITORIAL_PHOTOS = {
  interior: "/images/salon/interior.webp",
  treatment: "/images/salon/facial-treatment.webp",
  color: "/images/salon/color-service.webp",
  cut: "/images/salon/haircut-detail.webp",
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle(),
    description: await storefrontDescription(),
  }
}

export async function HomePage() {
  const [categories, featuredServices, stylists, brand] = await Promise.all([
    getServicesGroupedByCategory(),
    getFeaturedServices(4),
    getAllStylists(),
    getStorefrontBrand(),
  ])

  const activeStylists = stylists.filter((stylist) => stylist.isActive)
  const primaryService = featuredServices[0]
  const treatmentService = featuredServices.find((service) =>
    service.category?.name.toLowerCase().includes("skin")
  )
  const colorService = featuredServices.find((service) =>
    service.name.toLowerCase().includes("color")
  )
  const cutService = featuredServices.find((service) =>
    service.name.toLowerCase().includes("cut")
  )

  return (
    <div>
      <section className="sf-home-hero">
        <div className="sf-container sf-home-hero-grid">
          <div className="sf-home-hero-copy">
            <p className="sf-eyebrow">
              {brand.configured
                ? [brand.name, brand.city].filter(Boolean).join(" · ")
                : "Storefront setup required"}
            </p>
            <h1 className="sf-display sf-home-title">Hair, color &amp; skin.</h1>
            <div className="sf-home-actions">
              <Link href="/book" className="sf-btn sf-btn-primary">
                Reserve a visit
              </Link>
              <Link href="/services" className="sf-btn sf-btn-secondary">
                Explore the menu
              </Link>
            </div>

          </div>

          <div className="sf-home-hero-media">
            <figure className="sf-home-photo sf-home-photo-main">
              <img
                src={EDITORIAL_PHOTOS.interior}
                alt="Warm modern salon interior with mirrors and styling chairs"
                fetchPriority="high"
              />
              <figcaption>The studio</figcaption>
            </figure>
            <figure className="sf-home-photo sf-home-photo-inset">
              <img
                src={EDITORIAL_PHOTOS.color}
                alt="Hair colorist working with a client in the salon"
              />
              <figcaption>Color, considered</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="sf-home-index">
          <div className="sf-container sf-home-index-grid">
            <div>
              <h2 className="sf-display sf-home-section-title">Service categories</h2>
            </div>
            <div className="sf-home-category-list">
              {categories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/services#${category.id}`}
                  className="sf-home-category-row"
                >
                  <span className="sf-home-category-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="sf-home-category-name">
                    {category.name}
                    {category.description ? <small>{category.description}</small> : null}
                  </span>
                  <span className="sf-home-category-count">
                    {category.services?.length || 0} services
                    <ArrowUpRight aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sf-home-story">
        <div className="sf-container">
          <div className="sf-home-story-heading">
            <div>
              <h2 className="sf-display sf-home-section-title">Treatments</h2>
            </div>

          </div>

          <div className="sf-home-story-grid">
            <Link href={colorService ? `/services/${colorService.id}` : "/services"} className="sf-home-story-card sf-home-story-card-wide">
              <img src={EDITORIAL_PHOTOS.color} alt="Stylist applying dimensional color to a salon client" />
              <span className="sf-home-story-overlay">
                <small>Color studio</small>
                <strong>{colorService?.name || "Dimensional color"}</strong>
                {colorService ? (
                  <em>
                    <Clock3 aria-hidden="true" /> {colorService.baseDuration} min · {formatPrice(colorService.basePrice)}
                  </em>
                ) : null}
              </span>
            </Link>

            <Link href={treatmentService ? `/services/${treatmentService.id}` : "/services"} className="sf-home-story-card sf-home-story-card-tall">
              <img src={EDITORIAL_PHOTOS.treatment} alt="Client receiving a professional facial treatment" />
              <span className="sf-home-story-overlay">
                <small>Treatment room</small>
                <strong>{treatmentService?.name || "Skin rituals"}</strong>
                {treatmentService ? (
                  <em>
                    <Clock3 aria-hidden="true" /> {treatmentService.baseDuration} min · {formatPrice(treatmentService.basePrice)}
                  </em>
                ) : null}
              </span>
            </Link>

            <Link href={cutService ? `/services/${cutService.id}` : "/services"} className="sf-home-story-card sf-home-story-card-cut">
              <img src={EDITORIAL_PHOTOS.cut} alt="Precision haircut detail with scissors and comb" />
              <span className="sf-home-story-overlay">
                <small>At the chair</small>
                <strong>{cutService?.name || "Precision cutting"}</strong>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {featuredServices.length > 0 ? (
        <section className="sf-home-services">
          <div className="sf-container">
            <div className="sf-home-section-heading">
              <div>
                <h2 className="sf-display sf-home-section-title">Services</h2>
              </div>
              <Link href="/services" className="sf-link">
                View full service menu
              </Link>
            </div>
            <div className="sf-home-service-grid">
              {featuredServices.map((service, index) => (
                <div key={service.id} className={index === 0 ? "sf-home-service-feature" : undefined}>
                  <ServiceCard service={service} showCategory />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeStylists.length > 0 ? (
        <section className="sf-home-artists">
          <div className="sf-container sf-home-artists-grid">
            <div className="sf-home-artists-copy">
              <h2 className="sf-display sf-home-section-title">Artists</h2>
              <Link href="/team" className="sf-btn sf-btn-secondary">
                Meet every artist
              </Link>
            </div>
            <div className="sf-home-artist-grid">
              {activeStylists.slice(0, 3).map((stylist) => (
                <StylistCard key={stylist.id} stylist={stylist} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sf-home-reserve">
        <div className="sf-container sf-home-reserve-grid">
          <div>
            <h2 className="sf-display sf-home-reserve-title">Appointments</h2>
          </div>
          <div className="sf-home-reserve-action">
            {primaryService ? (
              <p>
                Services from {formatPrice(Math.min(...categories.flatMap((category) => category.services.map((service) => service.basePrice))))}.
              </p>
            ) : null}
            <Link href="/book" className="sf-btn sf-btn-primary">
              Reserve online
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
