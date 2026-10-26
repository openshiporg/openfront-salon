"use client"

import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
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
  { name: "Memberships", href: "/memberships" },
  { name: "Gift cards", href: "/gift-cards" },
  { name: "My appointments", href: "/account" },
]

// Booking and account pages own their primary action; the phone book bar would compete.
const NO_BOOK_BAR = ["/book", "/booking", "/account"]

export default function Nav({ brandName, logoIcon, logoColor }: NavProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"))
  const showBookBar = !NO_BOOK_BAR.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"))

  return (
    <>
      <header className="sf-nav">
        <div className="sf-container sf-nav-inner">
          <StoreBrand name={brandName} logoIcon={logoIcon} logoColor={logoColor} />

          <nav className="hidden lg:block" aria-label="Main">
            <ul className="flex items-center">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className="sf-nav-link">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/account" aria-current={isActive("/account") ? "page" : undefined} className="sf-nav-link hidden xl:inline-flex">
              My appointments
            </Link>
            <Link href="/book" className="sf-btn sf-btn-primary hidden sm:inline-flex">
              Book
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

        {mobileMenuOpen ? (
          <div id="sf-mobile-menu" className="sf-mobile-sheet lg:hidden">
            <nav className="sf-container pb-6 pt-1" aria-label="Mobile">
              {[...navigation, ...secondary].map((item) => (
                <Link key={item.name} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className="sf-mobile-link">
                  {item.name}
                </Link>
              ))}
              <div className="sf-track sf-track-block mt-6">
                <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      {showBookBar && !mobileMenuOpen ? (
        <div className="sf-book-bar">
          <div className="sf-track sf-track-block">
            <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
          </div>
        </div>
      ) : null}
    </>
  )
}
