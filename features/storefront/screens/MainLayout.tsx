import { Cormorant_Garamond, DM_Sans } from "next/font/google"
import { Metadata } from "next"
import type { CSSProperties } from "react"
import Link from "next/link"
import Nav from "@/features/storefront/modules/layout/templates/nav"
import Footer from "@/features/storefront/modules/layout/templates/footer"
import { getStorefrontBrand } from "@/features/storefront/lib/data/brand"
import "../styles/storefront.css"

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sf-display",
})

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        <div role="status" className="border-b border-[var(--sf-rule)] bg-[var(--sf-paper-2)] px-4 py-2 text-center text-[var(--sf-text-xs)] text-[var(--sf-ink-2)]">
          Online booking opens soon.
        </div>
      ) : null}
      <Nav brandName={brand.name} logoIcon={brand.logoIcon} logoColor={brand.logoColor} />
      <main className="flex-1 min-w-0">{children}</main>
      <Footer brand={brand} />
    </div>
  )
}

export const MainNotFoundMetadata: Metadata = {
  title: "404",
  description: "Page not found",
}

export function MainNotFound() {
  return (
    <div className="sf-container sf-page-pad-lg flex flex-col items-center justify-center text-center min-h-[60vh]">
      <p className="sf-eyebrow mb-4">404</p>
      <h1 className="sf-display text-[var(--sf-text-display-s)] mb-4">This page isn&apos;t here.</h1>
      <p className="sf-lead mx-auto mb-8">The route may have moved, or the link is out of date.</p>
      <Link href="/" className="sf-btn sf-btn-primary">
        Return home
      </Link>
    </div>
  )
}
