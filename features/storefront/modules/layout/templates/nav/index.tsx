"use client"

import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState } from "react"

interface NavProps {
  brandName: string | null
  logoIcon?: string
  logoColor?: string
}

const navigation = [
  { name: "Services", href: "/services" },
  { name: "Artists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Gift Cards", href: "/gift-cards" },
  { name: "Account", href: "/account" },
]

export default function Nav({ brandName, logoIcon, logoColor }: NavProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"))

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--sf-rule)] bg-[color-mix(in_oklch,var(--sf-paper)_92%,transparent)] backdrop-blur-md">
      <div className="sf-container flex h-[4.25rem] items-center justify-between gap-6">
        <StoreBrand name={brandName} logoIcon={logoIcon} logoColor={logoColor} />

        <nav className="hidden lg:flex items-center gap-8" aria-label="Main">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`text-[var(--sf-text-sm)] font-medium whitespace-nowrap transition-colors ${
                isActive(item.href)
                  ? "text-[var(--sf-ink)] underline underline-offset-[6px] decoration-[var(--sf-accent)] decoration-2"
                  : "text-[var(--sf-ink-2)] hover:text-[var(--sf-ink)]"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/book" className="sf-btn sf-btn-primary hidden sm:inline-flex">
            Reserve
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sf-btn sf-btn-secondary lg:hidden !min-h-[2.75rem] !min-w-[2.75rem] !px-3"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-[var(--sf-rule)] lg:hidden">
          <nav className="sf-container py-4 flex flex-col gap-1" aria-label="Mobile">
            <StoreBrand name={brandName} logoIcon={logoIcon} logoColor={logoColor} onClick={() => setMobileMenuOpen(false)} />
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[2.75rem] flex items-center px-2 text-[var(--sf-text-sm)] font-medium ${
                  isActive(item.href)
                    ? "text-[var(--sf-ink)]"
                    : "text-[var(--sf-ink-2)]"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/book"
              onClick={() => setMobileMenuOpen(false)}
              className="sf-btn sf-btn-primary mt-3 sm:hidden"
            >
              Reserve
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
