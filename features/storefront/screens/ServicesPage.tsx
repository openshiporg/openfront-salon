import { Metadata } from "next"
import Link from "next/link"
import { getServicesGroupedByCategory } from "../lib/data/services"
import { ServiceCard } from "../components/ServiceCard"
import { Search } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Services | Openfront Salon",
    description: "Browse our complete menu of salon services including hair, nails, skincare, and massage. Expert treatments with professional results.",
  }
}

export async function ServicesPage() {
  const categories = await getServicesGroupedByCategory()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 to-primary/5 py-16 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">Our Services</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Browse our complete menu of professional salon services. Prices may vary based on hair length, texture, and stylist experience level.
            </p>
          </div>
        </div>
      </section>

      {/* Categories Navigation */}
      {categories.length > 0 && (
        <section className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-all whitespace-nowrap text-sm font-medium"
                >
                  {category.name}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services by Category */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {categories.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Services Yet</h3>
              <p className="text-muted-foreground mb-6">
                Services will be available soon. Check back later!
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <div className="space-y-20">
              {categories.map((category) => (
                <div key={category.id} id={category.id}>
                  {/* Category Header */}
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold mb-2">{category.name}</h2>
                    {category.description && (
                      <p className="text-lg text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </div>

                  {/* Services Grid */}
                  {category.services && category.services.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      {category.services.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          variant="compact"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">
                        No services in this category yet.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Book?</h2>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Choose a service and select your preferred time to get started
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 text-lg font-medium hover:bg-primary/90 transition-all"
          >
            Book an Appointment
          </Link>
        </div>
      </section>
    </div>
  )
}
