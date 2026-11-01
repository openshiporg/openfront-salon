/** Salon-local calendar days as YYYY-MM-DD keys; read at UTC noon so no zone shifts the day. */

function atNoon(key: string) {
  return new Date(`${key}T12:00:00Z`)
}

export function todayIn(timezone?: string | null, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || undefined, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

export function addDaysKey(key: string, days: number): string {
  const date = atNoon(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dayNumber(key: string) {
  return atNoon(key).getUTCDate()
}

export function weekdayShort(key: string) {
  return atNoon(key).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
}

export function shortDate(key: string) {
  return atNoon(key).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** "Nov 2 – Nov 8" */
export function rangeLabel(from: string, to: string) {
  return `${shortDate(from)} – ${shortDate(to)}`
}

/** "Wed, Nov 4" */
export function dayLabel(key: string) {
  return atNoon(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

/** "10:00 AM" -> ["10:00", "AM"] */
export function splitSlotLabel(label: string): [string, string | null] {
  const match = label.trim().match(/^(.*?)\s*([AaPp]\.?[Mm]\.?)$/)
  return match ? [match[1], match[2].replace(/\./g, "").toUpperCase()] : [label, null]
}

export function bookHref({ stylistId, serviceId, date, time }: { stylistId?: string | null; serviceId?: string | null; date?: string | null; time?: string | null }) {
  const params = new URLSearchParams()
  if (serviceId) params.set("service", serviceId)
  if (stylistId) params.set("stylist", stylistId)
  if (date) params.set("date", date)
  if (time) params.set("time", time)
  const query = params.toString()
  return query ? `/book?${query}` : "/book"
}
