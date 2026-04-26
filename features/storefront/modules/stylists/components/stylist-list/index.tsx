import { Stylist } from "@/features/storefront/lib/data"
import StylistCard from "../stylist-card"

interface StylistListProps {
  stylists: Stylist[]
  compact?: boolean
}

export default function StylistList({ stylists, compact = false }: StylistListProps) {
  if (stylists.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No stylists available at this time.</p>
      </div>
    )
  }

  return (
    <div
      className={`grid gap-8 ${
        compact
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {stylists.map((stylist) => (
        <StylistCard key={stylist.id} stylist={stylist} compact={compact} />
      ))}
    </div>
  )
}
