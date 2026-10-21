import { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"
import { getServicesGroupedByCategory } from "../lib/data/services"
import { ServiceCard } from "../components/ServiceCard"
import { PageIntro } from "../components/ui/PageIntro"
import { storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle("Services"),
    description:
      "Browse our services with duration and pricing.",
  }
}

export async function ServicesPage() {
  const categories = await getServicesGroupedByCategory()

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="The service menu"
          size="large"
        />

        {categories.length > 0 ? (
          <nav
            className="mb-[var(--sf-space-lg)] flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
            aria-label="Service categories"
          >
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="sf-btn sf-btn-secondary !min-h-[2.75rem] whitespace-nowrap shrink-0"
              >
                {category.name}
              </a>
            ))}
          </nav>
        ) : null}

        {categories.length === 0 ? (
          <div className="text-center py-[var(--sf-space-2xl)] border border-[var(--sf-rule)]">
            <Search className="h-8 w-8 mx-auto mb-4 text-[var(--sf-ink-3)]" />
            <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">No services listed yet</h2>
            <p className="sf-lead mx-auto mb-6">Contact us to book.</p>
            <Link href="/" className="sf-btn sf-btn-primary">
              Back home
            </Link>
          </div>
        ) : (
          <div className="space-y-[var(--sf-space-2xl)]">
            {categories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-24">
                <div className="flex flex-col gap-3 mb-[var(--sf-space-md)] pb-[var(--sf-space-sm)] border-b border-[var(--sf-rule)] lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="sf-display text-[var(--sf-text-3xl)]">{category.name}</h2>
                    <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)] mt-1">
                      {category.services?.length || 0}{" "}
                      {(category.services?.length || 0) === 1 ? "service" : "services"}
                    </p>
                  </div>
                  {category.description ? (
                    <p className="sf-lead max-w-md">{category.description}</p>
                  ) : null}
                </div>

                {category.services && category.services.length > 0 ? (
                  <div className="grid gap-[var(--sf-space-md)] md:grid-cols-2">
                    {category.services.map((service) => (
                      <ServiceCard key={service.id} service={service} variant="compact" />
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)] py-8 text-center border border-dashed border-[var(--sf-rule)]">
                    No services in this category yet.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}

        {categories.length > 0 ? (
          <div className="mt-[var(--sf-space-2xl)] pt-[var(--sf-space-lg)] border-t border-[var(--sf-rule)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="sf-display text-[clamp(1.35rem,2.5vw,1.85rem)]">Appointments</p>
            <Link href="/book" className="sf-btn sf-btn-primary shrink-0">
              Reserve online
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
