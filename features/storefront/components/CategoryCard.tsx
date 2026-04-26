import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface CategoryCardProps {
  category: {
    id: string
    name: string
    description: string | null
    services?: { id: string }[]
  }
  href?: string
}

export function CategoryCard({ category, href }: CategoryCardProps) {
  const serviceCount = category.services?.length || 0
  const linkHref = href || `/services?category=${category.id}`

  return (
    <Link
      href={linkHref}
      className="group block p-6 border rounded-lg bg-card hover:shadow-xl transition-all hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-2xl mb-2 group-hover:text-primary transition-colors">
            {category.name}
          </h3>
          {category.description && (
            <p className="text-sm text-muted-foreground mb-3">
              {category.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {serviceCount} {serviceCount === 1 ? "service" : "services"}
          </p>
        </div>
        <div className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
