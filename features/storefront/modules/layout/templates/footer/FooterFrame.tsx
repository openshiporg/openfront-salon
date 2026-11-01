"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

// Booking and account pages are tasks: they get the one-line footer, not the full tray.
const QUIET = ["/book", "/booking", "/account"]
// The phone tab bar shows everywhere but the booking flow; the footer clears it.
const NO_TAB_BAR = ["/book", "/booking"]

export function FooterFrame({ full, quiet }: { full: ReactNode; quiet: ReactNode }) {
  const pathname = usePathname()
  const matches = (list: string[]) => list.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"))
  const isQuiet = matches(QUIET)
  return (
    <footer className={`sf-footer ${matches(NO_TAB_BAR) ? "" : "sf-has-book-bar"}`} data-quiet={isQuiet}>
      {isQuiet ? quiet : full}
    </footer>
  )
}
