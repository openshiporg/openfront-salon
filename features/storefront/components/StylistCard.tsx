import Link from "next/link"
import { getStorefrontImageSrc } from "../lib/images"

export interface StylistCardData {
  id: string
  user: { name: string } | null
  tier: string | null
  role?: string | null
  bio: string | null
  photo: { image: { url: string } | null; imagePath?: string | null; altText: string | null } | null
  specializations?: { name: string }[]
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

/** Portrait in an arch frame, level, specialties, working days and a booking pill. */
export function StylistCard({ stylist, showSpecializations = true, bookHref }: { stylist: StylistCardData; showSpecializations?: boolean; bookHref?: string }) {
  const name = stylist.user?.name || "Stylist"
  const firstName = name.split(" ")[0]
  const tier = stylistTitle(stylist.tier, stylist.role)
  const specialties = (stylist.specializations || []).map((service) => service.name).filter(Boolean)

  return (
    <article className="sf-artist">
      <Link href={`/team/${stylist.id}`} className="group block">
        <StylistPortrait stylist={stylist} />
        <h3 className="sf-artist-name group-hover:text-[var(--sf-accent)]">{name}</h3>
      </Link>
      {tier ? <p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">{tier}</p> : null}
      {showSpecializations && specialties.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{specialties.slice(0, 3).join(" · ")}</p>
      ) : null}
      {stylist.schedules ? <div className="mt-3"><WeekStrip schedules={stylist.schedules} /></div> : null}
      <div className="mt-4">
        <div className="sf-track">
          <Link href={bookHref || `/book?stylist=${stylist.id}`} className="sf-btn sf-btn-sm">Book with {firstName}</Link>
        </div>
      </div>
    </article>
  )
}
