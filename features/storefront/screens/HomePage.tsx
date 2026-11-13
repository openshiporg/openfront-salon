import { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Droplet, Gift, Play, Scissors, Sparkles, Wind, type LucideIcon } from "lucide-react"
import { getServicesGroupedByCategory, type Service } from "../lib/data/services"
import { getAllStylists, type Stylist } from "../lib/data/stylists"
import { getStorefrontImageSrc } from "../lib/images"
import { stylistTitle } from "../components/StylistCard"
import { getStorefrontBrand, storefrontDescription, storefrontTitle } from "../lib/data/brand"
import { publishedHours } from "../lib/hours"
import { formatMenuPrice } from "../lib/format-price"
import { BookingPicker, type PickerStylist } from "../components/BookingPicker"
import { NextAvailableChip, NextAvailableLink, type OpeningQuery } from "../components/NextAvailable"
import { bookHref, todayIn } from "../lib/picker-dates"
import { getStorefrontBenefits } from "../lib/data/benefits"

const HERO = "/images/salon/interior.webp"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle(),
    description: await storefrontDescription(),
  }
}

/** Collapse the published week into runs: "Mon – Thu 9AM – 8PM". */
function hoursSummary(hours: ReturnType<typeof publishedHours>) {
  const runs: Array<{ from: string; to: string; hours: string }> = []
  for (const day of hours) {
    const last = runs[runs.length - 1]
    if (last && last.hours === day.hours) last.to = day.short
    else runs.push({ from: day.short, to: day.short, hours: day.hours })
  }
  return runs.filter((run) => run.hours !== "Closed").map((run) => `${run.from === run.to ? run.from : `${run.from} – ${run.to}`} ${run.hours}`)
}

function serviceIcon(service: Service): LucideIcon {
  const text = `${service.name} ${service.category?.name || ""}`.toLowerCase()
  if (/colou?r|gloss|toner|balayage|highlight/.test(text)) return Droplet
  if (/blow|style|silk|wave/.test(text) && !/cut/.test(text)) return Wind
  if (/facial|skin|brow|lash|wax|scalp|treat/.test(text)) return Sparkles
  return Scissors
}

/** The service availability is read for: the first on the menu this stylist does. */
function stylistService(stylist: Stylist, menu: Service[]) {
  const ids = new Set(stylist.specializations.map((item) => item.id))
  return menu.find((service) => ids.has(service.id)) ?? null
}

/** Weekdays the stylist's published schedule has them in; days off need no availability read. */
function workDays(stylist: Stylist) {
  return [...new Set((stylist.schedules || []).filter((day) => day.isAvailable && day.dayOfWeek !== null).map((day) => day.dayOfWeek as number))]
}

export async function HomePage() {
  const [categories, stylists, brand, benefits] = await Promise.all([
    getServicesGroupedByCategory(),
    getAllStylists(),
    getStorefrontBrand(),
    getStorefrontBenefits(),
  ])

  const menu = categories.flatMap((category) => category.services)
  const today = todayIn(brand.timezone)
  const active = stylists.filter((stylist) => stylist.isActive)
  const bookable = active.flatMap((stylist) => {
    const service = stylistService(stylist, menu)
    return service ? [{ stylist, service }] : []
  })
  const pickerStylists: PickerStylist[] = bookable.map(({ stylist, service }) => ({
    id: stylist.id,
    name: stylist.user?.name || "Stylist",
    title: stylistTitle(stylist.tier, stylist.role),
    photo: getStorefrontImageSrc(stylist.photo),
    photoAlt: stylist.photo?.altText || stylist.user?.name || "Stylist",
    serviceId: service.id,
    duration: service.baseDuration,
    workDays: workDays(stylist),
  }))
  const openingQuery = (stylist: Stylist): OpeningQuery | null => {
    const service = stylistService(stylist, menu)
    return service ? { stylistId: stylist.id, serviceId: service.id, duration: service.baseDuration, locationId: brand.locationId, today, workDays: workDays(stylist) } : null
  }

  const listed = menu.slice(0, 4)
  const hours = hoursSummary(publishedHours(brand.hours, "short").map((day) => ({ ...day, hours: day.hours.replace(/(\d)(am|pm)/g, (_, digit, period) => `${digit}${period.toUpperCase()}`) })))
  const locality = [brand.city, brand.state].filter(Boolean).join(", ")
  const hasPlans = Boolean(benefits && (benefits.memberships.length || benefits.packages.length))
  const greeting = (() => {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: brand.timezone || undefined }).format(new Date()))
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  })()
  const phoneRows: Stylist[][] = []
  bookable.forEach(({ stylist }, index) => {
    if (index % 2 === 0) phoneRows.push([])
    phoneRows[phoneRows.length - 1].push(stylist)
  })

  return (
    <div>
      {/* ---------- Desktop ---------- */}
      <section className="sf-container hidden lg:block" aria-labelledby="home-title">
        <div className="sf-home">
          <div className="sf-home-copy">
            <h1 id="home-title" className="sf-home-title">Book your appointment and meet your stylist.</h1>
            {brand.description ? <p className="mt-6 max-w-[30rem] text-[length:var(--sf-text-md)] leading-relaxed text-[var(--sf-ink)]">{brand.description}</p> : null}
            <Link href="/services" className="sf-more mt-5">View all services<ChevronRight aria-hidden="true" /></Link>

            {listed.length ? (
              <ul className="sf-price-list mt-4 max-w-[22.5rem]">
                {listed.map((service) => (
                  <li key={service.id}>
                    <Link href={`/services/${service.id}`}>
                      <span>{service.name}</span>
                      <span className="tabular-nums">{service.pricingTier && Object.keys(service.pricingTier).length ? "from " : ""}{formatMenuPrice(service.basePrice)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="sf-facts mt-14 grid gap-4">
              {locality || brand.addressLine ? <div><dt>Location</dt><dd>{locality || brand.addressLine}</dd></div> : null}
              {hours.length ? <div><dt>Hours</dt><dd>{hours.map((line) => <span key={line} className="block">{line}</span>)}</dd></div> : null}
              {brand.email || brand.phone ? (
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {brand.email ? <a href={`mailto:${brand.email}`} className="block break-all no-underline hover:underline">{brand.email}</a> : null}
                    {brand.phone && brand.phoneHref ? <a href={brand.phoneHref} className="block no-underline hover:underline">{brand.phone}</a> : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sf-home-picker">
            {pickerStylists.length ? (
              <BookingPicker stylists={pickerStylists} today={today} locationId={brand.locationId} />
            ) : (
              <div className="sf-week-card grid gap-3">
                <p className="sf-display text-[length:var(--sf-text-xl)]">Online booking opens soon</p>
                <div className="sf-track"><Link href="/contact" className="sf-btn">Contact the salon</Link></div>
              </div>
            )}
          </div>

          {active.length ? (
            <section className="sf-home-stylists" aria-labelledby="home-stylists">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 id="home-stylists" className="sf-label">Stylists</h2>
                {active.length > 3 ? <Link href="/team" className="sf-more -my-3 text-[length:var(--sf-text-sm)]">View all<ChevronRight aria-hidden="true" /></Link> : null}
              </div>
              <ul className="grid grid-cols-3 gap-4">
                {active.slice(0, 3).map((stylist) => {
                  const photo = getStorefrontImageSrc(stylist.photo)
                  const name = stylist.user?.name || "Stylist"
                  return (
                    <li key={stylist.id}>
                      <Link href={`/team/${stylist.id}`} className="sf-portrait">
                        <figure>
                          {photo ? <img src={photo} alt={stylist.photo?.altText || name} loading="lazy" /> : <div className="sf-arch-placeholder aspect-[4/5]" aria-hidden="true">{name.charAt(0)}</div>}
                          <figcaption><span aria-hidden="true"><Play className="fill-current" /></span><span className="truncate">{name}</span></figcaption>
                        </figure>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </section>

      {/* ---------- Phone and tablet ---------- */}
      <div className="sf-home-phone lg:hidden">
        <section className="sf-hero" aria-labelledby="home-title-m">
          <img src={HERO} alt="" fetchPriority="high" />
          <div className="sf-container !w-full">
            <h1 id="home-title-m">{greeting}, book your time.</h1>
            {brand.description ? <p className="mt-1 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{brand.description}</p> : null}
          </div>
        </section>

        <div className="sf-container grid grid-cols-[minmax(0,1fr)] gap-3 pb-8">
          {phoneRows.length ? (
            <section className="sf-panel -mt-1 px-3.5 py-2.5" aria-label="Book a stylist">
              {phoneRows.map((row, rowIndex) => (
                <div key={rowIndex} className={rowIndex ? "mt-1.5 border-t border-[var(--sf-rule)] pt-2" : ""}>
                  <p className="mb-1 text-[length:var(--sf-text-md)]">{rowIndex === 0 ? "Select your stylist" : "Select your time"}</p>
                  <div className="sf-next-row">
                    {row.map((stylist, index) => (
                      <NextAvailableLink
                        key={stylist.id}
                        query={openingQuery(stylist)}
                        name={(stylist.user?.name || "Stylist").split(" ")[0]}
                        photo={getStorefrontImageSrc(stylist.photo)}
                        showPhoto={index === 0}
                        className="sf-next no-underline"
                      />
                    ))}
                    {row.length === 1 ? (
                      <Link href="/book" className="sf-next no-underline">
                        <span className="min-w-0">
                          <span className="block truncate text-[length:var(--sf-text-md)]">Any stylist</span>
                          <span className="block truncate text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">First open time</span>
                        </span>
                      </Link>
                    ) : null}
                    <Link href={bookHref({ stylistId: row[row.length - 1].id })} aria-label="See all times" className="col-start-3 -mr-2 inline-flex h-11 w-11 items-center justify-center text-[var(--sf-ink-3)]"><ChevronRight className="h-5 w-5" aria-hidden="true" /></Link>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {menu.length ? (
            <section aria-labelledby="home-services-m">
              <div className="mb-0.5 flex items-center justify-between gap-3">
                <h2 id="home-services-m" className="text-[length:var(--sf-text-lg)]">Services</h2>
                <Link href="/services" className="sf-more !text-[length:var(--sf-text-sm)] !text-[var(--sf-sage-ink)]">View all<ChevronRight aria-hidden="true" /></Link>
              </div>
              <div className="sf-scroller">
                {menu.map((service) => {
                  const Icon = serviceIcon(service)
                  return (
                    <Link key={service.id} href={`/book?service=${service.id}`} className="sf-service-chip">
                      <span className="sf-icon-tile" aria-hidden="true"><Icon /></span>
                      <span className="whitespace-nowrap">{service.name}</span>
                      <span className="ml-auto shrink-0 pl-1 text-[0.9375rem] tabular-nums text-[var(--sf-sage)]">{formatMenuPrice(service.basePrice)}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}

          {active.length ? (
            <section aria-labelledby="home-stylists-m">
              <div className="mb-0.5 flex items-center justify-between gap-3">
                <h2 id="home-stylists-m" className="text-[length:var(--sf-text-lg)]">Our stylists</h2>
                <Link href="/team" className="sf-more !text-[length:var(--sf-text-sm)] !text-[var(--sf-sage-ink)]">View all<ChevronRight aria-hidden="true" /></Link>
              </div>
              <div className="sf-scroller">
                {active.map((stylist) => {
                  const name = stylist.user?.name || "Stylist"
                  const photo = getStorefrontImageSrc(stylist.photo)
                  return (
                    <Link key={stylist.id} href={`/team/${stylist.id}`} className="sf-stylist-tile">
                      <span className="sf-arch block">{photo ? <img src={photo} alt={stylist.photo?.altText || name} loading="lazy" /> : <span className="sf-arch-placeholder" aria-hidden="true">{name.charAt(0)}</span>}</span>
                      <span className="flex items-center justify-between gap-1 px-0.5">
                        <span className="min-w-0 truncate text-[0.8125rem]">{name.split(" ")[0]}</span>
                        <NextAvailableChip query={openingQuery(stylist)} />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ) : null}

          <Link href="/gift-cards" className="sf-row-link">
            <span className="sf-icon-tile" aria-hidden="true"><Gift /></span>
            <span className="min-w-0">
              <span className="block text-[length:var(--sf-text-md)]">Gift Cards &amp; Memberships</span>
              <span className="block text-[length:var(--sf-text-xs)] text-[var(--sf-ink-3)]">Check a balance or see plans</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>

          {hasPlans ? (
            <Link href="/memberships" className="sf-banner">
              <span className="min-w-0 truncate">Join a membership &amp; save on visits.</span>
              <span>Explore<ChevronRight aria-hidden="true" /></span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
