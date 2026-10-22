import { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"
import { openStatus, publishedHours } from "../lib/hours"

export async function generateContactMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Visit"),
    description: brand.name ? `Hours, location, and contact details for ${brand.name}.` : "Salon hours, location, and contact details.",
  }
}

export async function ContactPage() {
  const brand = await getStorefrontBrand()
  const hours = publishedHours(brand.hours)
  const status = openStatus(brand.hours, brand.timezone)
  const mapsHref = brand.addressLine ? `https://maps.google.com/?q=${encodeURIComponent(brand.addressLine)}` : null

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          eyebrow={status ? <span className="sf-status !text-[var(--sf-text-sm)] !normal-case !tracking-normal"><span className="sf-dot" data-tone={status.open ? "open" : undefined} aria-hidden="true" />{status.label}</span> : undefined}
          title={<>Visit <em>&amp;</em> hours</>}
          size="large"
        />

        {!brand.configured ? (
          <p role="status" className="sf-note">Visit details not published.</p>
        ) : (
          <div className="grid gap-[var(--sf-space-lg)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              {brand.addressLine ? (
                <div className="sf-card p-[var(--sf-space-md)]">
                  <h2 className="sf-eyebrow mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />Location</h2>
                  {brand.locationName ? <p className="sf-display text-[var(--sf-text-xl)]">{brand.locationName}</p> : null}
                  <p className="mt-1 text-[var(--sf-text-md)] leading-relaxed text-[var(--sf-ink-2)]">{brand.addressLine}</p>
                  {mapsHref ? <div className="sf-track mt-4"><a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-sm">Directions<ArrowUpRight /></a></div> : null}
                </div>
              ) : null}

              {(brand.phone && brand.phoneHref) || brand.email ? (
                <div className="sf-card grid gap-4 p-[var(--sf-space-md)] sm:grid-cols-2">
                  {brand.phone && brand.phoneHref ? (
                    <div>
                      <h2 className="sf-eyebrow mb-2 flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden="true" />Phone</h2>
                      <a href={brand.phoneHref} className="sf-link text-[var(--sf-text-md)]">{brand.phone}</a>
                    </div>
                  ) : null}
                  {brand.email ? (
                    <div className="min-w-0">
                      <h2 className="sf-eyebrow mb-2 flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Email</h2>
                      <a href={`mailto:${brand.email}`} className="sf-link break-all text-[var(--sf-text-md)]">{brand.email}</a>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!brand.addressLine && !brand.phone && !brand.email ? <p className="sf-note">Contact details not published.</p> : null}

              <div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div>
            </div>

            <div className="sf-card p-[var(--sf-space-md)]">
              <h2 className="sf-eyebrow mb-3">Hours</h2>
              {hours.length ? (
                <dl className="divide-y divide-[var(--sf-rule)]">
                  {hours.map((schedule) => {
                    const isToday = schedule.key === status?.todayKey
                    return (
                      <div key={schedule.key} className={`flex justify-between gap-4 py-3 text-[var(--sf-text-md)] ${isToday ? "font-semibold text-[var(--sf-ink)]" : "text-[var(--sf-ink-2)]"}`}>
                        <dt>{schedule.day}{isToday ? <span className="ml-2 text-[var(--sf-text-xs)] text-[var(--sf-accent)]">Today</span> : null}</dt>
                        <dd className={`tabular-nums ${schedule.closed ? "text-[var(--sf-ink-3)]" : ""}`}>{schedule.hours}</dd>
                      </div>
                    )
                  })}
                </dl>
              ) : <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Hours not published.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
