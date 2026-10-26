import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getStorefrontImageSrc } from "../lib/images"
import { categoryBand, type CategoryBands } from "../lib/bands"

export interface StylistCardData {
  id: string
  user: { name: string } | null
  tier: string | null
  role?: string | null
  bio: string | null
  photo: { image: { url: string } | null; imagePath?: string | null; altText: string | null } | null
  specializations?: { id?: string; name: string }[]
  schedules?: { dayOfWeek: number | null; isAvailable: boolean }[]
}

const roleLabels: Record<string, string> = {
  stylist: "stylist", colorist: "colorist", nail_tech: "nail tech", esthetician: "esthetician",
  massage_therapist: "massage therapist", manager: "manager", receptionist: "receptionist",
}
const tierPrefix: Record<string, string> = { junior: "", senior: "Senior", master: "Master", director: "Creative director", celebrity: "Celebrity" }

/** "Senior esthetician", "Master stylist", "Nail tech": tier first, then the provider's role. */
export function stylistTitle(tier?: string | null, role?: string | null) {
  const roleText = roleLabels[role || "stylist"] || String(role || "stylist").replaceAll("_", " ")
  if (tier === "director") return tierPrefix.director
  const prefix = tier ? tierPrefix[tier] ?? "" : ""
  const text = prefix ? `${prefix} ${roleText}` : roleText
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const tierLabels: Record<string, string> = {
  junior: "Stylist",
  senior: "Senior stylist",
  master: "Master stylist",
  director: "Creative director",
  celebrity: "Celebrity stylist",
}

const WEEK = [
  { index: 1, label: "M" }, { index: 2, label: "T" }, { index: 3, label: "W" }, { index: 4, label: "T" },
  { index: 5, label: "F" }, { index: 6, label: "S" }, { index: 0, label: "S" },
]
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function WeekStrip({ schedules = [] }: { schedules?: { dayOfWeek: number | null; isAvailable: boolean }[] }) {
  const on = new Set(schedules.filter((schedule) => schedule.isAvailable && schedule.dayOfWeek !== null).map((schedule) => schedule.dayOfWeek))
  if (on.size === 0) return null
  return (
    <div className="sf-week" aria-label={`Works ${DAY_NAMES.filter((_, index) => on.has(index)).join(", ")}`}>
      {WEEK.map((day) => <span key={day.index} data-on={on.has(day.index)} aria-hidden="true">{day.label}</span>)}
    </div>
  )
}

export function StylistPortrait({ stylist, className = "" }: { stylist: StylistCardData; className?: string }) {
  const name = stylist.user?.name || "Stylist"
  const photoUrl = getStorefrontImageSrc(stylist.photo)
  return (
    <div className={`sf-arch ${className}`}>
      {photoUrl ? <img src={photoUrl} alt={stylist.photo?.altText || name} loading="lazy" /> : <div className="sf-arch-placeholder" aria-hidden="true">{name.charAt(0)}</div>}
    </div>
  )
}

/** Which category each service id sits in (null for uncategorized), from the service menu. */
export type ServiceCategoryIndex = Record<string, string | null>

export function serviceCategoryIndex(services: Array<{ id: string; category?: { id: string } | null }>): ServiceCategoryIndex {
  return Object.fromEntries(services.map((service) => [service.id, service.category?.id ?? null]))
}

/**
 * A stylist's band takes the shade of the category most of their services sit in,
 * so the stylist shelf reads as part of the same colour room. Ink when unknown.
 */
export function stylistBand(stylist: Pick<StylistCardData, "specializations">, bands?: CategoryBands | null, index?: ServiceCategoryIndex | null) {
  if (!bands || !index) return "ink"
  const counts = new Map<string, number>()
  for (const service of stylist.specializations || []) {
    if (!service.id || !(service.id in index)) continue
    const key = index[service.id] || ""
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  let best: string | null = null
  for (const [key, count] of counts) if (best === null || count > (counts.get(best) || 0)) best = key
  return best !== null ? categoryBand(bands, best || null) : "ink"
}

/** A stylist carton: band in their main category's shade, portrait window, name with title under it, working days, Book. */
export function StylistCard({ stylist, showSpecializations = true, bookHref, bands, serviceIndex }: { stylist: StylistCardData; showSpecializations?: boolean; bookHref?: string; bands?: CategoryBands | null; serviceIndex?: ServiceCategoryIndex | null }) {
  const name = stylist.user?.name || "Stylist"
  const firstName = name.split(" ")[0]
  const tier = stylistTitle(stylist.tier, stylist.role)
  const specialties = (stylist.specializations || []).map((service) => service.name).filter(Boolean)

  return (
    <article className="sf-carton" data-band={stylistBand(stylist, bands, serviceIndex)}>
      <div className="sf-carton-band">
        <span className="sf-shade" aria-hidden="true" />
      </div>
      <StylistPortrait stylist={stylist} className="sf-portrait-window" />
      <div className="sf-carton-body">
        <h3><Link href={`/team/${stylist.id}`} className="sf-carton-name">{name}</Link></h3>
        <p className="sf-carton-meta">{tier}</p>
        {showSpecializations && specialties.length > 0 ? (
          <p className="sf-carton-desc line-clamp-2">{specialties.slice(0, 3).join(", ")}</p>
        ) : null}
        {stylist.schedules ? <div className="mt-auto pt-2"><WeekStrip schedules={stylist.schedules} /></div> : null}
      </div>
      <Link href={bookHref || `/book?stylist=${stylist.id}`} className="sf-carton-action">
        <span className="min-w-0 truncate">Book with {firstName}</span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  )
}
