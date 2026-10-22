import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getStylistById } from "../lib/data/stylists"
import { getTierDisplayName } from "../lib/utils/stylist-helpers"
import { StylistPortrait, WeekStrip } from "../components/StylistCard"

interface StylistDetailPageProps {
  params: Promise<{ id: string }>
}

export async function StylistDetailPage({ params }: StylistDetailPageProps) {
  const { id } = await params
  const stylist = await getStylistById(id)

  if (!stylist) {
    notFound()
  }

  const name = stylist.user?.name || "Stylist"
  const firstName = name.split(" ")[0]
  const tierName = getTierDisplayName(stylist.tier || "junior")
  const specialties = stylist.specializations || []

  return (
    <div className="sf-page-pad !pt-[var(--sf-space-md)]">
      <div className="sf-container">
        <Link href="/team" className="sf-link inline-flex min-h-11 items-center gap-2 text-[var(--sf-text-sm)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All stylists
        </Link>

        <div className="mt-[var(--sf-space-md)] grid gap-[var(--sf-space-xl)] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-[var(--sf-space-2xl)]">
          <div className="min-w-0">
            <div className="md:sticky md:top-24">
              <StylistPortrait stylist={stylist} className="aspect-[4/5] w-full" />
              <div className="sf-track sf-track-block mt-5">
                <Link href={`/book?stylist=${stylist.id}`} className="sf-btn sf-btn-primary">Book with {firstName}</Link>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="sf-eyebrow mb-4">{tierName}</p>
            <h1 className="sf-display text-[var(--sf-text-display-s)]">{name}</h1>
            {stylist.bio ? <p className="mt-6 max-w-[58ch] text-[var(--sf-text-lg)] leading-relaxed text-[var(--sf-ink-2)]">{stylist.bio}</p> : null}

            {stylist.schedules?.some((schedule) => schedule.isAvailable) ? (
              <section className="mt-[var(--sf-space-lg)] max-w-sm" aria-labelledby="stylist-days">
                <h2 id="stylist-days" className="sf-eyebrow mb-3">Working days</h2>
                <WeekStrip schedules={stylist.schedules} />
              </section>
            ) : null}

            {specialties.length > 0 ? (
              <section className="mt-[var(--sf-space-xl)]" aria-labelledby="stylist-services">
                <h2 id="stylist-services" className="sf-display mb-4 text-[var(--sf-text-2xl)]">Book a service with {firstName}</h2>
                <ul className="sf-menu">
                  {specialties.map((service) => (
                    <li key={service.id} className="flex items-center gap-4 border-b border-[var(--sf-rule)] py-3.5">
                      <Link href={`/services/${service.id}`} className="sf-display min-w-0 truncate text-[var(--sf-text-lg)] hover:text-[var(--sf-accent)]">{service.name}</Link>
                      <span className="sf-menu-leader" aria-hidden="true" />
                      <div className="sf-track shrink-0">
                        <Link href={`/book?service=${service.id}&stylist=${stylist.id}`} className="sf-btn sf-btn-sm">Book</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {stylist.certifications ? (
              <section className="sf-card-quiet mt-[var(--sf-space-xl)] p-[var(--sf-space-md)]" aria-labelledby="stylist-training">
                <h2 id="stylist-training" className="sf-eyebrow mb-3">Training & certifications</h2>
                <p className="whitespace-pre-line text-[var(--sf-text-sm)] leading-relaxed text-[var(--sf-ink-2)]">{stylist.certifications}</p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
