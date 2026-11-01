"use client"

import { useEffect, useState } from "react"

const WIDE = "(min-width: 1024px)"

/**
 * Whether the desktop layout is showing (null before the first client read). The home page
 * mounts both layouts and lets CSS pick one, so their availability reads are gated on this.
 */
export function useWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return wide
}
