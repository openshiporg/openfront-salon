import { Metadata } from "next"
import Link from "next/link"
import { Calendar, Search } from "lucide-react"
import { StylistCard } from "../components/StylistCard"
import { getAllStylists } from "../lib/data/stylists"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Our Artists"),
    description: brand.name ? `Meet the stylists and specialists on the ${brand.name} roster.` : "Meet the salon's stylists and specialists.",
  }
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function getAvailabilityLabels(
  schedules: { dayOfWeek: number | null; isAvailable: boolean }[] = []
) {
  return schedules
    .filter((schedule) => schedule.isAvailable)
    .flatMap((schedule) => schedule.dayOfWeek == null ? [] : [dayLabels[schedule.dayOfWeek]])
    .filter(Boolean)
}

export async function StylistsPage() {
  const stylists = await getAllStylists()

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="Artists on the floor"
          size="large"
        />

        {stylists.length === 0 ? (
          <div className="text-center py-[var(--sf-space-2xl)] border border-[var(--sf-rule)]">
            <Search className="h-8 w-8 mx-auto mb-4 text-[var(--sf-ink-3)]" />
            <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">No artists available online</h2>
            <p className="sf-lead mx-auto mb-6">Contact the salon for current provider availability, or browse the service menu.</p>
            <Link href="/services" className="sf-btn sf-btn-primary">
              Browse services
            </Link>
          </div>
        ) : (
          <div className="grid gap-[var(--sf-space-lg)] md:grid-cols-2 lg:grid-cols-3">
            {stylists.map((stylist) => {
              const availability = getAvailabilityLabels(stylist.schedules)
              const firstName = stylist.user?.name?.split(" ")[0] || "this artist"

              return (
                <article key={stylist.id} className="flex flex-col">
                  <StylistCard stylist={stylist} />
                  <div className="mt-3 border border-[var(--sf-rule)] bg-[var(--sf-paper)] p-[var(--sf-space-md)]">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {availability.length > 0 ? (
                        availability.map((day) => (
                          <span
                            key={day}
                            className="px-2 py-0.5 text-[var(--sf-text-xs)] border border-[var(--sf-rule)] text-[var(--sf-ink-2)]"
                          >
                            {day}
                          </span>
                        ))
                      ) : (
                        <span className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">
                          Schedule by request
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/book?stylist=${stylist.id}`}
                      className="sf-btn sf-btn-primary w-full"
                    >
                      <Calendar className="h-4 w-4" />
                      Book with {firstName}
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
