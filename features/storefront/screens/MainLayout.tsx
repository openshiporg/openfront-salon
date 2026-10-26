import { Archivo } from "next/font/google"
import { Metadata } from "next"
import type { CSSProperties } from "react"
import Link from "next/link"
import Nav from "@/features/storefront/modules/layout/templates/nav"
import Footer from "@/features/storefront/modules/layout/templates/footer"
import { getStorefrontBrand, storefrontTitle } from "@/features/storefront/lib/data/brand"
import "../styles/colour-room.css"

// One family along its width axis: condensed caps for carton names, wide numerals, normal body.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-sf",
})

type StorefrontThemeStyle = CSSProperties & { "--sf-theme-hue": number }

export async function MainLayout({ children }: { children: React.ReactNode }) {
  const brand = await getStorefrontBrand()
  const themeStyle: StorefrontThemeStyle = { "--sf-theme-hue": brand.themeHue }

  return (
    <div
      className={`storefront ${archivo.variable} flex min-h-svh flex-col`}
      style={themeStyle}
    >
      {!brand.configured ? (
        <div role="status" className="flex items-center justify-center gap-2 border-b border-[var(--sf-ink)] bg-[var(--sf-alu)] px-4 py-2 text-center text-[length:var(--sf-text-xs)] font-semibold text-[var(--sf-ink)]">
          <span className="sf-dot" data-tone="warn" aria-hidden="true" />
          Online booking opens soon
        </div>
      ) : null}
      <Nav brandName={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer brand={brand} />
    </div>
  )
}

export async function generateNotFoundMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Page not found"), description: "Page not found" }
}

export function MainNotFound() {
  return (
    <div className="sf-container sf-page-pad-lg">
      <div className="sf-carton mx-auto max-w-md" data-band="ink">
        <div className="sf-carton-band"><span>Not on the shelf</span><span className="sf-shade" aria-hidden="true" /></div>
        <div className="sf-carton-body gap-5">
          <h1 className="sf-display text-[length:var(--sf-text-3xl)]">Page not found</h1>
          <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">The link may be old, or the page was moved.</p>
          <div className="sf-track">
            <Link href="/" className="sf-btn sf-btn-primary">Home</Link>
            <Link href="/services" className="sf-btn sf-btn-quiet">Services</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
