import { Metadata } from "next"
import Link from "next/link"
import { Search } from "lucide-react"
import { StylistCard } from "../components/StylistCard"
import { getAllStylists } from "../lib/data/stylists"
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
  const stylists = await getAllStylists()

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          eyebrow={stylists.length ? `${stylists.length} ${stylists.length === 1 ? "stylist" : "stylists"}` : undefined}
          title={<>The stylists</>}
          size="large"
        />

        {stylists.length === 0 ? (
          <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-2xl)] text-center">
            <Search className="mb-4 h-7 w-7 text-[var(--sf-ink-3)]" aria-hidden="true" />
            <h2 className="sf-display mb-6 text-[length:var(--sf-text-2xl)]">No stylists listed online</h2>
            <div className="sf-track"><Link href="/services" className="sf-btn">Service menu</Link></div>
          </div>
        ) : (
          <div className="sf-artist-grid">
            {stylists.map((stylist) => <StylistCard key={stylist.id} stylist={stylist} />)}
          </div>
        )}
      </div>
    </div>
  )
}
