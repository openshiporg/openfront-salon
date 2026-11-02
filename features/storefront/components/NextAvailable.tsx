"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { findNextOpenings, type NextOpening, type OpeningQuery } from "../lib/data/next-available"
import { bookHref, openingLabel, openingPill } from "../lib/picker-dates"
import { useWide } from "../lib/use-wide"

export type { OpeningQuery }

type OpeningRead = { status: "loading" } | { status: "ready"; opening: NextOpening | null }

const keyOf = (query: OpeningQuery) => `${query.stylistId}:${query.serviceId}:${query.today}`

// One read per stylist per page, shared by every place that shows it; queries asked for in the
// same render are sent to the server together.
const reads = new Map<string, Promise<NextOpening | null>>()
let pending: Array<{ query: OpeningQuery; resolve: (opening: NextOpening | null) => void }> = []

function flush() {
  const batch = pending
  pending = []
  findNextOpenings(batch.map((item) => item.query))
    .then((openings) => batch.forEach((item, index) => item.resolve(openings[index] ?? null)))
    .catch(() => batch.forEach((item) => item.resolve(null)))
}

function readOpening(query: OpeningQuery) {
  const key = keyOf(query)
  let read = reads.get(key)
  if (!read) {
    read = new Promise<NextOpening | null>((resolve) => {
      if (pending.length === 0) setTimeout(flush, 0)
      pending.push({ query, resolve })
    })
    reads.set(key, read)
  }
  return read
}

export function useNextOpening(query: OpeningQuery | null): OpeningRead {
  const [state, setState] = useState<OpeningRead>({ status: "loading" })
  const key = query ? keyOf(query) : null
  // These sit on the phone layout only.
  const narrow = useWide() === false
  useEffect(() => {
    if (!query || !narrow) return
    let cancelled = false
    readOpening(query).then((opening) => {
      if (!cancelled) setState({ status: "ready", opening })
    })
    return () => { cancelled = true }
    // The key carries everything the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, narrow])
  return query ? state : { status: "ready", opening: null }
}

/** One stylist in the phone "select your stylist" panel: name, next opening, link to that time. */
export function NextAvailableLink({ query, name, photo, showPhoto, className, style }: {
  query: OpeningQuery | null
  name: string
  photo: string | null
  showPhoto: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const read = useNextOpening(query)
  const opening = read.status === "ready" ? read.opening : null
  const first = opening?.slots[0]
  const href = query ? bookHref({ stylistId: query.stylistId, date: opening?.date, time: first?.startTime }) : "/book"
  return (
    <Link href={href} className={className} style={style}>
      {showPhoto ? (
        <span className="sf-arch">{photo ? <img src={photo} alt="" /> : <span className="sf-arch-placeholder" aria-hidden="true">{name.charAt(0)}</span>}</span>
      ) : null}
      <span className="min-w-0">
        <span className="block truncate text-[length:var(--sf-text-md)]">{name}</span>
        <span className="block truncate text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]" aria-live="polite">
          {read.status === "loading" ? "Checking…" : opening ? "Next available" : "See times"}
        </span>
        {opening && first ? <span className="sf-next-when"><span className="max-[429px]:hidden">{openingLabel(opening.date, first.label)}</span><span className="min-[430px]:hidden">{openingPill(opening.date, first.label)}</span></span> : null}
      </span>
    </Link>
  )
}

/** Small "Nov 3" chip on a stylist tile once their next open day is known. */
export function NextAvailableChip({ query }: { query: OpeningQuery | null }) {
  const read = useNextOpening(query)
  if (read.status !== "ready" || !read.opening) return null
  const first = read.opening.slots[0]
  return <span className="sf-tile-pill" title="Next available">{first ? openingPill(read.opening.date, first.label) : null}</span>
}
