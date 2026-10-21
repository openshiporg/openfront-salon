import { Metadata } from "next"
import Link from "next/link"
import { Clock, Mail, MapPin, Phone } from "lucide-react"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle, type LocationHours } from "../lib/data/brand"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

function formatTime(value?: string | null): string | null {
  if (!value) return null
  const [hourValue, minuteValue] = value.split(":").map(Number)
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) return value
  const period = hourValue >= 12 ? "PM" : "AM"
  const hour = hourValue % 12 || 12
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`
}

function publishedHours(hours: LocationHours | null) {
  if (!hours) return []
  return DAYS.flatMap((day) => {
    const value = hours[day]
    if (!value) return []
    const label = day.replace(/^./, (letter) => letter.toUpperCase())
    if (value.closed) return [{ day: label, hours: "Closed" }]
    const open = formatTime(value.open)
    const close = formatTime(value.close)
    return open && close ? [{ day: label, hours: `${open} – ${close}` }] : []
  })
}

export async function generateContactMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Contact"),
    description: brand.name ? `Published hours, location, and contact details for ${brand.name}.` : "Published salon hours, location, and contact details.",
  }
}

export async function ContactPage() {
  const brand = await getStorefrontBrand()
  const hours = publishedHours(brand.hours)
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" })
  const mapsHref = brand.addressLine
    ? `https://maps.google.com/?q=${encodeURIComponent(brand.addressLine)}`
    : null

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="Visit & hours"
          description={brand.configured ? undefined : "Visit details not published."}
          size="large"
        />

        {!brand.configured ? (
          <div role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-[var(--sf-space-md)] text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
            Contact details are coming soon.
          </div>
        ) : (
          <div className="grid gap-[var(--sf-space-lg)] lg:grid-cols-[1fr_1fr]">
            <div className="space-y-[var(--sf-space-md)]">
              {brand.addressLine ? (
                <div className="sf-card p-[var(--sf-space-md)]">
                  <div className="flex gap-4">
                    <MapPin className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
                    <div>
                      <h2 className="sf-display text-[var(--sf-text-xl)] mb-2">Location</h2>
                      {brand.locationName ? <p className="font-medium">{brand.locationName}</p> : null}
                      <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)] leading-relaxed">{brand.addressLine}</p>
                      {mapsHref ? <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sf-link inline-block mt-3 text-[var(--sf-text-sm)]">Open in maps</a> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {brand.phone && brand.phoneHref ? (
                <div className="sf-card p-[var(--sf-space-md)]">
                  <div className="flex gap-4">
                    <Phone className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
                    <div>
                      <h2 className="sf-display text-[var(--sf-text-xl)] mb-2">Phone</h2>
                      <a href={brand.phoneHref} className="sf-link text-[var(--sf-text-md)]">{brand.phone}</a>
                    </div>
                  </div>
                </div>
              ) : null}

              {brand.email ? (
                <div className="sf-card p-[var(--sf-space-md)]">
                  <div className="flex gap-4">
                    <Mail className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
                    <div>
                      <h2 className="sf-display text-[var(--sf-text-xl)] mb-2">Email</h2>
                      <a href={`mailto:${brand.email}`} className="sf-link text-[var(--sf-text-md)]">{brand.email}</a>
                    </div>
                  </div>
                </div>
              ) : null}

              {!brand.addressLine && !brand.phone && !brand.email ? (
                <p className="sf-card p-[var(--sf-space-md)] text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Contact details have not been published for this location.</p>
              ) : null}
            </div>

            <div className="sf-card p-[var(--sf-space-md)]">
              <div className="flex items-center gap-3 mb-6">
                <Clock className="h-5 w-5 text-[var(--sf-accent)]" />
                <h2 className="sf-display text-[var(--sf-text-xl)]">Hours</h2>
              </div>
              {hours.length ? (
                <ul className="divide-y divide-[var(--sf-rule)]">
                  {hours.map((schedule) => {
                    const isToday = schedule.day === todayName
                    return (
                      <li key={schedule.day} className={`flex justify-between gap-4 py-3 text-[var(--sf-text-sm)] ${isToday ? "text-[var(--sf-ink)] font-medium" : "text-[var(--sf-ink-2)]"}`}>
                        <span>{schedule.day}{isToday ? <span className="ml-2 text-[var(--sf-text-xs)] text-[var(--sf-accent)]">Today</span> : null}</span>
                        <span>{schedule.hours}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Hours have not been published.</p>}
            </div>
          </div>
        )}

        <div className="mt-[var(--sf-space-xl)] border border-[var(--sf-rule)] p-[var(--sf-space-lg)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="sf-display text-[clamp(1.35rem,2.5vw,1.85rem)]">Appointments</p>
          <Link href="/book" className="sf-btn sf-btn-primary shrink-0">Reserve a visit</Link>
        </div>
      </div>
    </div>
  )
}
