import Link from "next/link"
import { User, Award } from "lucide-react"

interface StylistCardProps {
  stylist: {
    id: string
    user: {
      name: string
    } | null
    tier: string | null
    bio: string | null
    photo: {
      image: {
        url: string
      } | null
      altText: string | null
    } | null
    specializations?: {
      name: string
    }[]
  }
  variant?: "default" | "compact"
  showSpecializations?: boolean
}

export function StylistCard({
  stylist,
  variant = "default",
  showSpecializations = true
}: StylistCardProps) {
  const name = stylist.user?.name || "Stylist"
  const photoUrl = stylist.photo?.image?.url
  const tier = stylist.tier || "junior"
  const tierLabels: Record<string, string> = {
    junior: "Junior Stylist",
    senior: "Senior Stylist",
    master: "Master Stylist",
    director: "Creative Director"
  }

  if (variant === "compact") {
    return (
      <Link
        href={`/team/${stylist.id}`}
        className="group flex items-center gap-4 p-4 border rounded-lg bg-card hover:shadow-lg transition-all hover:border-primary/50"
      >
        <div className="shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={stylist.photo?.altText || name}
              className="w-16 h-16 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-border group-hover:border-primary transition-colors">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">{tierLabels[tier]}</p>
          {showSpecializations && stylist.specializations && stylist.specializations.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Award className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate">
                {stylist.specializations.map(s => s.name).join(", ")}
              </p>
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/team/${stylist.id}`}
      className="group block overflow-hidden rounded-lg border bg-card hover:shadow-xl transition-all hover:border-primary/50"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={stylist.photo?.altText || name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-24 w-24 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold text-xl group-hover:text-primary transition-colors">
              {name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{tierLabels[tier]}</p>
          </div>
        </div>
        {stylist.bio && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {stylist.bio}
          </p>
        )}
        {showSpecializations && stylist.specializations && stylist.specializations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Specializations</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stylist.specializations.slice(0, 3).map((spec, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                >
                  {spec.name}
                </span>
              ))}
              {stylist.specializations.length > 3 && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  +{stylist.specializations.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
