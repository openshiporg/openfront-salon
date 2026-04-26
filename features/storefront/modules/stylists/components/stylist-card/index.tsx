import Link from "next/link"
import { Stylist } from "@/features/storefront/lib/data"
import {
  calculateYearsExperience,
  getTierDisplayName,
  getAvailableDays,
} from "@/features/storefront/lib/utils/stylist-helpers"

interface StylistCardProps {
  stylist: Stylist
  showBookButton?: boolean
  compact?: boolean
}

function getTierBadgeColor(tier: string) {
  switch (tier) {
    case "master":
    case "celebrity":
      return "bg-amber-100 text-amber-800"
    case "senior":
      return "bg-blue-100 text-blue-800"
    case "junior":
      return "bg-green-100 text-green-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

export default function StylistCard({
  stylist,
  showBookButton = true,
  compact = false,
}: StylistCardProps) {
  const name = stylist.user?.name || "Unknown Stylist"
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
  const yearsExp = calculateYearsExperience(stylist.hireDate)
  const availableDays = getAvailableDays(stylist.schedules)

  if (compact) {
    return (
      <div className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow bg-card">
        <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
          {stylist.photo?.image?.url ? (
            <img
              src={stylist.photo.image.url}
              alt={stylist.photo.altText || name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
          )}
        </div>
        <h3 className="font-semibold text-lg">{name}</h3>
        <p className="text-sm text-primary mb-2">{getTierDisplayName(stylist.tier)}</p>
        {yearsExp > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            {yearsExp} years experience
          </p>
        )}
        <div className="flex flex-wrap gap-1 justify-center">
          {stylist.specializations.slice(0, 3).map((spec) => (
            <span key={spec.id} className="text-xs bg-secondary px-2 py-1 rounded">
              {spec.name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center overflow-hidden">
            {stylist.photo?.image?.url ? (
              <img
                src={stylist.photo.image.url}
                alt={stylist.photo.altText || name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">{initials}</span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{name}</h3>
            <p className="text-sm text-primary">{getTierDisplayName(stylist.tier)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span
            className={`text-xs font-medium px-2 py-1 rounded ${getTierBadgeColor(stylist.tier)}`}
          >
            {stylist.tier.charAt(0).toUpperCase() + stylist.tier.slice(1)}
          </span>
          {yearsExp > 0 && (
            <span className="text-xs text-muted-foreground">
              {yearsExp} years experience
            </span>
          )}
        </div>

        {stylist.bio && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{stylist.bio}</p>
        )}

        {stylist.specializations.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium mb-2">Specializations</p>
            <div className="flex flex-wrap gap-1">
              {stylist.specializations.map((spec) => (
                <span key={spec.id} className="text-xs bg-secondary px-2 py-1 rounded">
                  {spec.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {availableDays.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium mb-2">Available</p>
            <div className="flex gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span
                  key={day}
                  className={`text-xs px-2 py-1 rounded ${
                    availableDays.includes(day)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        )}

        {showBookButton && (
          <Link
            href={`/book?stylist=${stylist.id}`}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Book with {name.split(" ")[0]}
          </Link>
        )}
      </div>
    </div>
  )
}
