"use client"

import Link from "next/link"
import { StoreBrand } from "@/features/storefront/components/StoreBrand"
import { usePathname } from "next/navigation"
import { ChevronRight, CircleUserRound, Gift, House, Menu, Scissors, UserRound, X } from "lucide-react"
import { useEffect, useState } from "react"

interface NavProps {
  brandName: string | null
  tagline?: string | null
  logoIcon?: string
  logoColor?: string
}

const navigation = [
  { name: "Home", href: "/" },
  { name: "About", href: "/contact" },
  { name: "Services", href: "/services" },
  { name: "Stylists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Gift Cards & Memberships", href: "/gift-cards" },
]

const sheet = [
  { name: "Services", href: "/services" },
  { name: "Stylists", href: "/team" },
  { name: "Gallery", href: "/gallery" },
  { name: "Reviews", href: "/reviews" },
  { name: "Memberships", href: "/memberships" },
  { name: "Gift cards", href: "/gift-cards" },
  { name: "Visit & hours", href: "/contact" },
  { name: "My appointments", href: "/account" },
]

const tabs = [
  { name: "Home", href: "/", icon: House },
  { name: "Book", href: "/book", icon: Scissors },
  { name: "Stylists", href: "/team", icon: CircleUserRound },
  { name: "Gift Cards", href: "/gift-cards", icon: Gift },
  { name: "Profile", href: "/account", icon: UserRound },
]

// The booking flow docks its own tray at the bottom of a phone screen; the tab bar would compete.
const NO_TAB_BAR = ["/book", "/booking"]

export default function Nav({ brandName, tagline, logoIcon, logoColor }: NavProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || Boolean(pathname?.startsWith(href + "/"))
  const showTabBar = !NO_TAB_BAR.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"))

  return (
    <>
      <header className="sf-nav">
        <div className="sf-container sf-nav-inner">
          <StoreBrand name={brandName} tagline={tagline} logoIcon={logoIcon} logoColor={logoColor} />

          <nav className="hidden min-w-0 lg:block" aria-label="Main">
            <ul className="flex items-center">
              {navigation.map((item) => (
                <li key={item.name} className={item.name === "Reviews" || item.name === "About" ? "hidden xl:block" : undefined}>
                  <Link href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className="sf-nav-link">
                    {item.name}
                  </Link>
                </li>
              ))}
              <li className="hidden xl:block">
                <button type="button" className="sf-nav-link !px-1 cursor-pointer border-0 bg-transparent" aria-label="More pages" aria-expanded={mobileMenuOpen} aria-controls="sf-mobile-menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  <ChevronRight className="h-4 w-4 text-[var(--sf-ink-3)]" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            <Link href="/book" className="sf-btn hidden lg:inline-flex !min-h-[2.875rem] !px-7">
              Book Now
            </Link>
            <Link href="/account" aria-current={isActive("/account") ? "page" : undefined} className="sf-account-link lg:hidden">
              <span aria-hidden="true"><UserRound /></span>
              <span>My Account</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sf-btn sf-btn-icon !border-0 lg:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="sf-mobile-menu"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div id="sf-mobile-menu" className="sf-mobile-sheet">
            <nav className="sf-container pb-6 pt-1 lg:grid lg:grid-cols-4 lg:gap-x-8" aria-label="All pages">
              {sheet.map((item) => (
                <Link key={item.name} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className="sf-mobile-link">
                  {item.name}
                </Link>
              ))}
              <div className="sf-track sf-track-block mt-6 lg:hidden">
                <Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      {showTabBar && !mobileMenuOpen ? (
        <nav className="sf-tabbar" aria-label="Quick">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link key={tab.name} href={tab.href} aria-current={isActive(tab.href) ? "page" : undefined}>
                <Icon aria-hidden="true" />
                {tab.name}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </>
  )
}
