import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import type { StorefrontBrand } from "@/features/storefront/lib/data/brand"
import { FooterFrame } from "./FooterFrame"

const LINKS = [
  { name: "Services", href: "/services" },
  { name: "Stylists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Memberships", href: "/memberships" },
  { name: "Gift cards", href: "/gift-cards" },
  { name: "Visit & hours", href: "/contact" },
  { name: "My appointments", href: "/account" },
]

export default function Footer({ brand }: { brand: StorefrontBrand }) {
  const currentYear = new Date().getFullYear()
  const copyright = brand.name ? <p className="text-[length:var(--sf-text-xs)]">&copy; {currentYear} {brand.name}</p> : null

  const full = (
    <div className="sf-container grid gap-[var(--sf-space-md)] py-[var(--sf-space-lg)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="grid content-start gap-3 text-[var(--sf-ink)]">
        <StoreBrand name={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} />
        {copyright}
      </div>
      <div className="grid content-start gap-3">
        {brand.addressLine ? (
          <p className="leading-relaxed">{brand.locationName ? <><span className="font-semibold text-[var(--sf-ink)]">{brand.locationName}</span><br /></> : null}{brand.addressLine}</p>
        ) : null}
        {brand.phone && brand.phoneHref ? <a href={brand.phoneHref} className="inline-flex min-h-11 items-center font-semibold text-[var(--sf-ink)]">{brand.phone}</a> : null}
        {brand.email ? <a href={`mailto:${brand.email}`} className="break-all">{brand.email}</a> : null}
      </div>
      <nav aria-label="Footer" className="sf-footer-links grid grid-cols-2 content-start gap-x-6">
        {LINKS.map((link) => <Link key={link.href} href={link.href}>{link.name}</Link>)}
      </nav>
    </div>
  )

  const quiet = (
    <div className="sf-container flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
      <div className="text-[var(--sf-ink)]"><StoreBrand name={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} /></div>
      <nav aria-label="Footer" className="sf-footer-links flex flex-wrap gap-x-5">
        {brand.phone && brand.phoneHref ? <a href={brand.phoneHref}>{brand.phone}</a> : null}
        <Link href="/contact">Visit &amp; hours</Link>
        <Link href="/services">Services</Link>
      </nav>
    </div>
  )

  return <FooterFrame full={full} quiet={quiet} />
}
