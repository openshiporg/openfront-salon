import { Metadata } from "next"
import Link from "next/link"
import { getServicesGroupedByCategory } from "../lib/data/services"
import { ServiceCarton, bandFor } from "../components/ServiceCard"
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
          title="Services"
          description={total ? `${total} ${total === 1 ? "service" : "services"}, each with its time in the chair and its price.` : undefined}
        />
      </div>

      {categories.length > 1 ? (
        <div className="sf-sticky-tabs">
          <div className="sf-container">
            <nav aria-label="Service categories" className="sf-track sf-track-scroll !gap-0">
              {categories.map((category, index) => (
                <a key={category.id} href={`#${category.id}`} className="sf-tab" data-band={bandFor(index)}>
                  <span className="sf-shade" aria-hidden="true" />
                  {category.name}
                </a>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="sf-container">
        {categories.length === 0 ? (
          <div className="sf-carton sf-carton-empty mx-auto max-w-md" data-band="ink">
            <h2 className="sf-display text-[length:var(--sf-text-2xl)]">No services listed yet</h2>
            <div className="sf-track"><Link href="/contact" className="sf-btn">Contact the salon</Link></div>
          </div>
        ) : (
          <div className="grid gap-[var(--sf-space-xl)]">
            {categories.map((category, index) => (
              <section key={category.id} id={category.id} className="scroll-mt-32" aria-labelledby={`category-${category.id}`} data-band={bandFor(index)}>
                <div className="sf-shelf-head">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="sf-shade" aria-hidden="true" />
                    <h2 id={`category-${category.id}`} className="sf-display text-[length:var(--sf-text-3xl)]">{category.name}</h2>
                  </div>
                  {category.description ? <p className="max-w-[48ch] text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{category.description}</p> : null}
                </div>

                {category.services && category.services.length > 0 ? (
                  <div className="sf-shelf-grid" data-cols="4">
                    {category.services.map((service) => <ServiceCarton key={service.id} service={service} band={bandFor(index)} bandLabel={category.name} showDescription />)}
                  </div>
                ) : (
                  <p className="sf-note">No services in this category yet.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
