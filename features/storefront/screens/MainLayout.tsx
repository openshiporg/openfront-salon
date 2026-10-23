import { Fraunces, Hanken_Grotesk } from "next/font/google"
import { Metadata } from "next"
import type { CSSProperties } from "react"
import Link from "next/link"
import Nav from "@/features/storefront/modules/layout/templates/nav"
import Footer from "@/features/storefront/modules/layout/templates/footer"
import { getStorefrontBrand, storefrontTitle } from "@/features/storefront/lib/data/brand"
import "../styles/storefront.css"

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-sf-display",
})

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sf-body",
})

type StorefrontThemeStyle = CSSProperties & { "--sf-theme-hue": number }

export async function MainLayout({ children }: { children: React.ReactNode }) {
  const brand = await getStorefrontBrand()
  const themeStyle: StorefrontThemeStyle = { "--sf-theme-hue": brand.themeHue }

  return (
    <div
      className={`storefront ${display.variable} ${body.variable} min-h-screen flex flex-col`}
      style={themeStyle}
    >
      {!brand.configured ? (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-[var(--sf-rule)] bg-[var(--sf-paper-2)] px-4 py-2 text-center text-[length:var(--sf-text-xs)] font-medium text-[var(--sf-ink-2)]">
          <span className="sf-dot" data-tone="warn" aria-hidden="true" />
          Online booking opens soon
        </div>
      ) : null}
      <Nav brandName={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} />
      <main className="flex-1 min-w-0">{children}</main>
      <Footer brand={brand} />
    </div>
  )
}

export async function generateNotFoundMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Page not found"), description: "Page not found" }
}

export function MainNotFound() {
  return (
    <div className="sf-container sf-page-pad-lg flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="sf-swatch-fan mb-6" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((swatch) => <span key={swatch} className="sf-swatch" data-swatch={swatch} />)}
      </span>
      <p className="sf-eyebrow mb-4">404</p>
      <h1 className="sf-display mb-8 text-[length:var(--sf-text-display-s)]">Page not found</h1>
      <div className="sf-track">
        <Link href="/" className="sf-btn sf-btn-primary">Home</Link>
        <Link href="/services" className="sf-btn sf-btn-quiet">Service menu</Link>
      </div>
    </div>
  )
}
