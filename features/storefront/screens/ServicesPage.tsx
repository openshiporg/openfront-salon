import { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"
import { getServicesGroupedByCategory } from "../lib/data/services"
import { ServiceMenuRow } from "../components/ServiceCard"
import { PageIntro } from "../components/ui/PageIntro"
import { storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await storefrontTitle("Services"),
    description: "Service menu with duration and pricing.",
  }
}

export async function ServicesPage() {
  const categories = await getServicesGroupedByCategory()
  const total = categories.reduce((sum, category) => sum + (category.services?.length || 0), 0)

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          eyebrow={total ? `${total} ${total === 1 ? "service" : "services"}` : undefined}
          title={<>Service <em>menu</em></>}
          size="large"
          aside={total ? <div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div> : null}
        />
      </div>

      {categories.length > 1 ? (
        <div className="sf-sticky-tabs">
          <div className="sf-container">
            <nav aria-label="Service categories" className="sf-track sf-track-scroll">
              {categories.map((category, index) => (
                <a key={category.id} href={`#${category.id}`} className="sf-btn sf-btn-quiet sf-btn-sm !gap-2 shrink-0">
                  <span className="sf-swatch !h-3.5 !w-3.5" data-swatch={(index % 6) + 1} aria-hidden="true" />
                  {category.name}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="sf-container">
        {categories.length === 0 ? (
          <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-2xl)] text-center">
            <Search className="mb-4 h-7 w-7 text-[var(--sf-ink-3)]" aria-hidden="true" />
            <h2 className="sf-display mb-6 text-[var(--sf-text-2xl)]">No services listed yet</h2>
            <div className="sf-track"><Link href="/contact" className="sf-btn">Contact the salon</Link></div>
          </div>
        ) : (
          <div className="mt-[var(--sf-space-lg)] grid gap-[var(--sf-space-2xl)]">
            {categories.map((category, index) => (
              <section key={category.id} id={category.id} className="scroll-mt-36" aria-labelledby={`category-${category.id}`}>
                <div className="sf-category-head">
                  <div className="flex items-center gap-4">
                    <span className="sf-swatch !h-9 !w-9" data-swatch={(index % 6) + 1} aria-hidden="true" />
                    <div>
                      <h2 id={`category-${category.id}`} className="sf-display text-[var(--sf-text-3xl)]">{category.name}</h2>
                      <p className="mt-1 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{category.services?.length || 0} {(category.services?.length || 0) === 1 ? "service" : "services"}</p>
                    </div>
                  </div>
                  {category.description ? <p className="text-[var(--sf-text-sm)] leading-relaxed text-[var(--sf-ink-2)] md:text-right">{category.description}</p> : null}
                </div>

                {category.services && category.services.length > 0 ? (
                  <div className="sf-menu">
                    {category.services.map((service) => <ServiceMenuRow key={service.id} service={service} />)}
                  </div>
                ) : (
                  <p className="sf-note text-center">No services in this category yet.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
