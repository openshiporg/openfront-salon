import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import type { StorefrontBrand } from "@/features/storefront/lib/data/brand"
import { publishedHours } from "@/features/storefront/lib/hours"

const LINKS = [
  { name: "Services", href: "/services" },
  { name: "Stylists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Gift cards", href: "/gift-cards" },
  { name: "Visit & hours", href: "/contact" },
  { name: "My appointments", href: "/account" },
]

export default function Footer({ brand }: { brand: StorefrontBrand }) {
  const currentYear = new Date().getFullYear()
  const hours = publishedHours(brand.hours, "short")

  return (
    <footer className="sf-footer sf-has-book-bar">
      <div className="sf-container py-[var(--sf-space-2xl)]">
        <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="sf-footer-title">{brand.configured ? <>Book a <em className="sf-italic">visit</em></> : "Opening soon"}</p>
            {brand.configured ? (
              <div className="sf-track mt-8">
                <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
              </div>
            ) : null}
          </div>

          <div className="grid gap-8 text-[var(--sf-text-sm)] sm:grid-cols-2">
            <div className="grid content-start gap-5">
              {brand.addressLine ? (
                <div>
                  <p className="sf-eyebrow !text-current opacity-60">Visit</p>
                  <p className="mt-2 leading-relaxed">{brand.locationName ? <>{brand.locationName}<br /></> : null}{brand.addressLine}</p>
                </div>
              ) : null}
              {brand.phone || brand.email ? (
                <div className="grid gap-1">
                  <p className="sf-eyebrow !text-current opacity-60">Contact</p>
                  {brand.phone && brand.phoneHref ? <a href={brand.phoneHref} className="mt-1">{brand.phone}</a> : null}
                  {brand.email ? <a href={`mailto:${brand.email}`} className="break-all">{brand.email}</a> : null}
                </div>
              ) : null}
            </div>
            {hours.length > 0 ? (
              <div>
                <p className="sf-eyebrow !text-current opacity-60">Hours</p>
                <dl className="mt-2 grid gap-1">
                  {hours.map((day) => (
                    <div key={day.key} className="flex justify-between gap-4">
                      <dt>{day.short}</dt>
                      <dd className={`tabular-nums ${day.closed ? "opacity-60" : ""}`}>{day.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </div>

        <hr className="sf-rule my-[var(--sf-space-lg)]" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <StoreBrand name={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[var(--sf-text-sm)]">
            {LINKS.map((link) => <Link key={link.href} href={link.href}>{link.name}</Link>)}
          </nav>
          <p className="text-[var(--sf-text-xs)] opacity-60">{brand.name ? <>&copy; {currentYear} {brand.name}</> : null}</p>
        </div>
      </div>
    </footer>
  )
}
