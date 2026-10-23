"use client"

import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import { usePathname } from "next/navigation"
import { ArrowUpRight, CalendarPlus, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"

interface NavProps {
  brandName: string | null
  logoIcon?: string
  logoColor?: string
}

const navigation = [
  { name: "Services", href: "/services" },
  { name: "Stylists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Visit", href: "/contact" },
]

const secondary = [
  { name: "Gift cards", href: "/gift-cards" },
  { name: "My appointments", href: "/account" },
]

// Booking and account pages own their primary action; the floating bar would compete.
const NO_BOOK_BAR = ["/book", "/booking", "/account"]

export default function Nav({ brandName, logoIcon, logoColor }: NavProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"))
  const showBookBar = !NO_BOOK_BAR.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"))

  return (
    <>
      <header className="sf-nav" data-scrolled={scrolled || mobileMenuOpen}>
        <div className="sf-container sf-nav-inner">
          <StoreBrand name={brandName} logoIcon={logoIcon} logoColor={logoColor} />

          <nav className="sf-nav-links hidden lg:block" aria-label="Main">
            <div className="sf-track">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="sf-btn sf-btn-quiet"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/account" className="sf-link hidden text-[length:var(--sf-text-sm)] xl:inline">
              My appointments
            </Link>
            <div className="sf-track">
              <Link href="/book" className="sf-btn sf-btn-primary hidden sm:inline-flex">
                Book now
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sf-btn sf-btn-icon lg:hidden"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="sf-mobile-menu"
              >
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div id="sf-mobile-menu" className="sf-mobile-sheet lg:hidden">
            <nav className="sf-container pb-6 pt-2" aria-label="Mobile">
              {[...navigation, ...secondary].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="sf-mobile-link"
                >
                  {item.name}
                  <ArrowUpRight className="h-5 w-5 text-[var(--sf-ink-3)]" aria-hidden="true" />
                </Link>
              ))}
              <div className="sf-track sf-track-block mt-6">
                <Link href="/book" className="sf-btn sf-btn-primary">
                  <CalendarPlus />
                  Book an appointment
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      {showBookBar && !mobileMenuOpen ? (
        <div className="sf-book-bar">
          <div className="sf-track sf-track-block">
            <Link href="/book" className="sf-btn sf-btn-primary">
              <CalendarPlus />
              Book an appointment
            </Link>
          </div>
        </div>
      ) : null}
    </>
  )
}
