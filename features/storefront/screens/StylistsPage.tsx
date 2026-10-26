import { Metadata } from "next"
import Link from "next/link"
import { StylistCard, serviceCategoryIndex } from "../components/StylistCard"
import { getAllStylists } from "../lib/data/stylists"
import { getAllServices, getCategoryBands } from "../lib/data/services"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Stylists"),
    description: brand.name ? `Stylists and specialists at ${brand.name}.` : "Salon stylists and specialists.",
  }
}

export async function StylistsPage() {
  const [stylists, bands, catalog] = await Promise.all([getAllStylists(), getCategoryBands(), getAllServices()])
  const serviceIndex = catalog.status === "available" ? serviceCategoryIndex(catalog.items) : null

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="Stylists"
          description={stylists.length ? "Pick who you would like to see, or book a service and choose on the way." : undefined}
        />

        {stylists.length === 0 ? (
          <div className="sf-carton sf-carton-empty mx-auto max-w-md" data-band="ink">
            <h2 className="sf-display text-[length:var(--sf-text-2xl)]">No stylists listed online</h2>
            <div className="sf-track"><Link href="/services" className="sf-btn">Services</Link></div>
          </div>
        ) : (
          <div className="sf-shelf-grid" data-cols="4">
            {stylists.map((stylist) => <StylistCard key={stylist.id} stylist={stylist} bands={bands} serviceIndex={serviceIndex} />)}
          </div>
        )}
      </div>
    </div>
  )
}
