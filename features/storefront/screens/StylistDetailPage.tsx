import type { Metadata } from "next"
import { stylistTitle } from "../components/StylistCard"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { getStylistById } from "../lib/data/stylists"
import { getTierDisplayName } from "../lib/utils/stylist-helpers"
import { StylistPortrait, WeekStrip, serviceCategoryIndex, stylistBand } from "../components/StylistCard"
import { getAllServices, getCategoryBands } from "../lib/data/services"
import { storefrontTitle } from "../lib/data/brand"

interface StylistDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: StylistDetailPageProps): Promise<Metadata> {
  const stylist = await getStylistById((await params).id)
  if (!stylist) return { title: await storefrontTitle("Page not found"), description: "Page not found" }
  return { title: await storefrontTitle(stylist.user?.name || "Stylist"), description: stylist.bio || undefined }
}

export async function StylistDetailPage({ params }: StylistDetailPageProps) {
  const { id } = await params
  const [stylist, bands, catalog] = await Promise.all([getStylistById(id), getCategoryBands(), getAllServices()])

  if (!stylist) {
    notFound()
  }

  const name = stylist.user?.name || "Stylist"
  const firstName = name.split(" ")[0]
  const tierName = stylistTitle(stylist.tier, stylist.role)
  const specialties = stylist.specializations || []

  return (
    <div className="sf-page-pad !pt-[var(--sf-space-sm)]">
      <div className="sf-container">
        <Link href="/team" className="sf-link inline-flex min-h-11 items-center gap-2 text-[length:var(--sf-text-sm)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All stylists
        </Link>

        <div className="mt-[var(--sf-space-sm)] grid gap-[var(--sf-space-xl)] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-[var(--sf-space-2xl)]">
          <div className="min-w-0">
            <div className="sf-carton md:sticky md:top-24" data-band={stylistBand(stylist, bands, catalog.status === "available" ? serviceCategoryIndex(catalog.items) : null)}>
              <div className="sf-carton-band"><span className="sf-shade" aria-hidden="true" /></div>
              <StylistPortrait stylist={stylist} className="aspect-[4/5] w-full" />
              <Link href={`/book?stylist=${stylist.id}`} className="sf-carton-action">Book with {firstName}<ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="sf-display text-[length:var(--sf-text-display-s)]">{name}</h1>
            <p className="mt-2 text-[length:var(--sf-text-md)] font-semibold text-[var(--sf-ink-2)]">{tierName}</p>
            {stylist.bio ? <p className="mt-6 max-w-[58ch] text-[length:var(--sf-text-lg)] leading-relaxed text-[var(--sf-ink-2)]">{stylist.bio}</p> : null}

            {stylist.schedules?.some((schedule) => schedule.isAvailable) ? (
              <section className="mt-[var(--sf-space-lg)] max-w-sm" aria-labelledby="stylist-days">
                <h2 id="stylist-days" className="mb-3 text-[length:var(--sf-text-sm)] font-semibold">Working days</h2>
                <WeekStrip schedules={stylist.schedules} />
              </section>
            ) : null}

            {specialties.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="stylist-services">
                <h2 id="stylist-services" className="sf-display mb-1 border-b border-[var(--sf-ink)] pb-2 text-[length:var(--sf-text-2xl)]">Book a service with {firstName}</h2>
                <ul>
                  {specialties.map((service) => (
                    <li key={service.id} className="flex items-center justify-between gap-4 border-b border-[var(--sf-rule)] py-2.5">
                      <Link href={`/services/${service.id}`} className="sf-carton-name min-w-0 truncate">{service.name}</Link>
                      <Link href={`/book?service=${service.id}&stylist=${stylist.id}`} className="sf-btn sf-btn-sm shrink-0">Book</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {stylist.certifications ? (
              <section className="sf-tray-surface mt-[var(--sf-space-xl)] p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]" aria-labelledby="stylist-training">
                <h2 id="stylist-training" className="mb-2 text-[length:var(--sf-text-sm)] font-semibold">Training &amp; certifications</h2>
                <p className="whitespace-pre-line text-[length:var(--sf-text-sm)] leading-relaxed text-[var(--sf-ink-2)]">{stylist.certifications}</p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
