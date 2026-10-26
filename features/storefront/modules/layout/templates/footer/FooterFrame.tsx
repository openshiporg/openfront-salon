"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

// Booking and account pages are tasks: they get the one-line footer, not the full tray.
const QUIET = ["/book", "/booking", "/account"]

export function FooterFrame({ full, quiet }: { full: ReactNode; quiet: ReactNode }) {
  const pathname = usePathname()
  const isQuiet = QUIET.some((prefix) => pathname === prefix || pathname?.startsWith(prefix + "/"))
  return (
    <footer className={`sf-footer ${isQuiet ? "" : "sf-has-book-bar"}`} data-quiet={isQuiet}>
      {isQuiet ? quiet : full}
    </footer>
  )
}
