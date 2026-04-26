import Link from "next/link"
import { Clock, DollarSign } from "lucide-react"
import { Service } from "../lib/data/services"

interface ServiceCardProps {
  service: Service
  showCategory?: boolean
  variant?: "default" | "compact"
}

export function ServiceCard({ service, showCategory = false, variant = "default" }: ServiceCardProps) {
  const price = service.basePrice
  const duration = service.baseDuration

  if (variant === "compact") {
    return (
      <Link
        href={`/services/${service.id}`}
        className="group block p-4 border rounded-lg bg-card hover:shadow-lg transition-all hover:border-primary/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
              {service.name}
            </h3>
            {service.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {service.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{duration} min</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold">
                <DollarSign className="h-4 w-4" />
                <span>${price}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <div className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Book
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/services/${service.id}`}
      className="group block overflow-hidden rounded-lg border bg-card hover:shadow-xl transition-all hover:border-primary/50"
    >
      {service.image?.image?.url && (
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={service.image.image.url}
            alt={service.image.altText || service.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-6">
        {showCategory && service.category && (
          <div className="text-xs font-medium text-primary mb-2">
            {service.category.name}
          </div>
        )}
        <h3 className="font-semibold text-xl mb-2 group-hover:text-primary transition-colors">
          {service.name}
        </h3>
        {service.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {service.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{duration} min</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-lg">
              <DollarSign className="h-5 w-5" />
              <span>${price}</span>
            </div>
          </div>
          <div className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Book Now
          </div>
        </div>
        {(service.requiresConsultation || service.requiresPatchTest) && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              {service.requiresConsultation && "Consultation required"}
              {service.requiresConsultation && service.requiresPatchTest && " • "}
              {service.requiresPatchTest && "Patch test required"}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
