import { Metadata } from "next"
import Link from "next/link"
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"
import { bookableHours, openStatus, publishedHours } from "../lib/hours"
import { getAllStylists } from "../lib/data/stylists"

export async function generateContactMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Visit"),
    description: brand.name ? `Hours, location, and contact details for ${brand.name}.` : "Salon hours, location, and contact details.",
  }
}

export async function ContactPage() {
  const [brand, stylists] = await Promise.all([getStorefrontBrand(), getAllStylists().catch(() => [])])
  const hours = publishedHours(brand.hours)
  const bookable = stylists.length ? bookableHours(stylists) : null
  const status = openStatus(brand.hours, brand.timezone, new Date(), stylists)
  const mapsHref = brand.addressLine ? `https://maps.google.com/?q=${encodeURIComponent(brand.addressLine)}` : null

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="Visit & hours"
          description={status ? <span className="sf-status"><span className="sf-dot" data-tone={status.open ? "open" : undefined} aria-hidden="true" />{status.label}</span> : undefined}
        />

        {!brand.configured ? (
          <p role="status" className="sf-note">Visit details not published.</p>
        ) : (
          <div className="grid gap-[var(--sf-space-lg)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-[var(--sf-space-md)]">
              {brand.addressLine ? (
                <section aria-labelledby="visit-address">
                  <h2 id="visit-address" className="sf-display mb-3 flex items-center gap-2 text-[length:var(--sf-text-xl)]"><MapPin className="h-5 w-5" aria-hidden="true" />Address</h2>
                  <p className="text-[length:var(--sf-text-md)] leading-relaxed">{brand.locationName ? <><span className="font-semibold">{brand.locationName}</span><br /></> : null}{brand.addressLine}</p>
                  {mapsHref ? <div className="sf-track mt-4"><a href={mapsHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn-quiet">Directions<ArrowUpRight /></a></div> : null}
                </section>
              ) : null}

              {(brand.phone && brand.phoneHref) || brand.email ? (
                <section aria-labelledby="visit-contact" className="border-t border-[var(--sf-rule)] pt-[var(--sf-space-md)]">
                  <h2 id="visit-contact" className="sf-display mb-3 text-[length:var(--sf-text-xl)]">Phone &amp; email</h2>
                  <div className="grid gap-2 text-[length:var(--sf-text-md)]">
                    {brand.phone && brand.phoneHref ? <a href={brand.phoneHref} className="sf-link inline-flex min-h-11 items-center gap-2 self-start"><Phone className="h-4 w-4" aria-hidden="true" />{brand.phone}</a> : null}
                    {brand.email ? <a href={`mailto:${brand.email}`} className="sf-link inline-flex min-h-11 min-w-0 items-center gap-2 self-start break-all"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{brand.email}</a> : null}
                  </div>
                </section>
              ) : null}

              {!brand.addressLine && !brand.phone && !brand.email ? <p className="sf-note">Contact details not published.</p> : null}

              <div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div>
            </div>

            <section aria-labelledby="visit-hours" className="sf-tray-surface p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
              <h2 id="visit-hours" className="sf-display mb-2 text-[length:var(--sf-text-xl)]">Hours</h2>
              {hours.length ? (
                <dl>
                  {hours.map((schedule) => {
                    const isToday = schedule.key === status?.todayKey
                    return (
                      <div key={schedule.key} className={`sf-summary-row !text-[length:var(--sf-text-md)] ${isToday ? "font-semibold" : ""}`}>
                        <dt className={isToday ? "!text-[var(--sf-ink)]" : ""}>{schedule.day}{isToday ? " (today)" : ""}</dt>
                        <dd className={`tabular-nums ${schedule.closed ? "!font-normal text-[var(--sf-ink-3)]" : ""}`}>{schedule.hours}{bookable && !schedule.closed && bookable[schedule.key] !== schedule.hours ? <span className="block text-[length:var(--sf-text-xs)] font-normal text-[var(--sf-ink-3)]">{bookable[schedule.key] === "No appointments" ? "No appointments" : `Appointments ${bookable[schedule.key]}`}</span> : null}</dd>
                      </div>
                    )
                  })}
                </dl>
              ) : <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Hours not published.</p>}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
