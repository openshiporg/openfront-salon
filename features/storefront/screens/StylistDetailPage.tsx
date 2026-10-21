import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Clock, User } from "lucide-react"
import { getStylistById } from "../lib/data/stylists"
import { getTierDisplayName } from "../lib/utils/stylist-helpers"
import { getStorefrontImageSrc } from "../lib/images"

interface StylistDetailPageProps {
  params: Promise<{ id: string }>
}

export async function StylistDetailPage({ params }: StylistDetailPageProps) {
  const { id } = await params
  const stylist = await getStylistById(id)

  if (!stylist) {
    notFound()
  }

  const name = stylist.user?.name || "Artist"
  const photoUrl = getStorefrontImageSrc(stylist.photo)
  const tierName = getTierDisplayName(stylist.tier || "junior")

  const availableDays = stylist.schedules
    ? stylist.schedules
        .filter((s) => s.isAvailable)
        .map((s) => {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          return s.dayOfWeek == null ? null : days[s.dayOfWeek]
        })
    : []

  return (
    <div>
      <div className="border-b border-[var(--sf-rule)] sticky top-[4.25rem] z-10 bg-[color-mix(in_oklch,var(--sf-paper)_92%,transparent)] backdrop-blur-md">
        <div className="sf-container py-3">
          <Link href="/team" className="sf-link inline-flex items-center gap-2 text-[var(--sf-text-sm)]">
            <ArrowLeft className="h-4 w-4" />
            All artists
          </Link>
        </div>
      </div>

      <div className="sf-container sf-page-pad">
        <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.75fr)]">
          <div className="min-w-0 space-y-[var(--sf-space-lg)]">
            <div className="grid gap-[var(--sf-space-md)] md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={stylist.photo?.altText || name}
                  className="aspect-[4/5] w-full max-w-[220px] object-cover border border-[var(--sf-rule)]"
                />
              ) : (
                <div className="aspect-[4/5] w-full max-w-[220px] flex items-center justify-center border border-[var(--sf-rule)] bg-[var(--sf-paper-2)]">
                  <User className="h-16 w-16 text-[var(--sf-ink-3)]" />
                </div>
              )}

              <div>
                <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] mb-2">{tierName}</p>
                <h1 className="sf-display text-[var(--sf-text-display-s)] mb-4">{name}</h1>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)] mb-6">
                  {stylist.specializations && stylist.specializations.length > 0 ? (
                    <div>
                      <dt className="sr-only">Specializations</dt>
                      <dd>{stylist.specializations.length} listed specialties</dd>
                    </div>
                  ) : null}
                </dl>
                {stylist.bio ? (
                  <p className="text-[var(--sf-text-md)] text-[var(--sf-ink-2)] leading-relaxed max-w-prose">
                    {stylist.bio}
                  </p>
                ) : null}
              </div>
            </div>

            {stylist.certifications ? (
              <div className="sf-card p-[var(--sf-space-md)]">
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-3">Training & certifications</h2>
                <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)] whitespace-pre-line leading-relaxed">
                  {stylist.certifications}
                </p>
              </div>
            ) : null}

            {stylist.specializations && stylist.specializations.length > 0 ? (
              <div>
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-4">Signature services</h2>
                <ul className="divide-y divide-[var(--sf-rule)] border-y border-[var(--sf-rule)]">
                  {stylist.specializations.map((service) => (
                    <li key={service.id}>
                      <Link
                        href={`/services/${service.id}`}
                        className="flex items-center justify-between py-3 text-[var(--sf-text-sm)] hover:bg-[var(--sf-paper-2)] -mx-2 px-2 transition-colors"
                      >
                        <span className="text-[var(--sf-ink)]">{service.name}</span>
                        <span className="text-[var(--sf-ink-3)]">View</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {availableDays.length > 0 ? (
              <div className="sf-card p-[var(--sf-space-md)]">
                <h2 className="sf-display text-[var(--sf-text-xl)] mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[var(--sf-accent)]" />
                  Weekly availability
                </h2>
                <div className="flex flex-wrap gap-2">
                  {availableDays.map((day) => (
                    <span
                      key={day}
                      className="px-2.5 py-1 text-[var(--sf-text-xs)] border border-[var(--sf-rule)] text-[var(--sf-ink-2)]"
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">
                  Exact slots appear during booking.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="sf-card p-[var(--sf-space-md)]">
              <h2 className="sf-display text-[var(--sf-text-xl)] mb-6">Book with {name.split(" ")[0]}</h2>
              <dl className="space-y-3 text-[var(--sf-text-sm)] mb-6">
                <div className="flex justify-between gap-4 border-b border-[var(--sf-rule)] pb-3">
                  <dt className="text-[var(--sf-ink-3)]">Level</dt>
                  <dd className="font-medium">{tierName}</dd>
                </div>
                {stylist.specializations ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--sf-ink-3)]">Services</dt>
                    <dd className="font-medium">{stylist.specializations.length}</dd>
                  </div>
                ) : null}
              </dl>

              <Link href={`/book?stylist=${stylist.id}`} className="sf-btn sf-btn-primary w-full mb-3">
                <Calendar className="h-4 w-4" />
                Reserve with {name.split(" ")[0]}
              </Link>

              <Link href="/services" className="sf-btn sf-btn-secondary w-full">
                Browse services
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
