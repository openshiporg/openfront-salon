import Link from "next/link"
import { User } from "lucide-react"
import { getStorefrontImageSrc } from "../lib/images"

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
      imagePath?: string | null
      altText: string | null
    } | null
    specializations?: {
      name: string
    }[]
  }
  variant?: "default" | "compact"
  showSpecializations?: boolean
  linked?: boolean
}

const tierLabels: Record<string, string> = {
  junior: "Junior",
  senior: "Senior",
  master: "Master",
  director: "Director",
  celebrity: "Celebrity",
}

export function StylistCard({
  stylist,
  variant = "default",
  showSpecializations = true,
  linked = true,
}: StylistCardProps) {
  const name = stylist.user?.name || "Artist"
  const photoUrl = getStorefrontImageSrc(stylist.photo)
  const tier = stylist.tier ? tierLabels[stylist.tier] ?? null : null

  if (variant === "compact") {
    const content = (
      <div className="flex items-center gap-4 p-[var(--sf-space-md)]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={stylist.photo?.altText || name}
            className="h-14 w-14 shrink-0 object-cover bg-[var(--sf-paper-3)]"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 flex items-center justify-center bg-[var(--sf-paper-3)] border border-[var(--sf-rule)]">
            <User className="h-6 w-6 text-[var(--sf-ink-3)]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="sf-display text-[var(--sf-text-lg)] text-[var(--sf-ink)] truncate">{name}</h3>
          {tier ? <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">{tier}</p> : null}
        </div>
      </div>
    )

    return linked ? (
      <Link href={`/team/${stylist.id}`} className="sf-card group block">
        {content}
      </Link>
    ) : (
      <div className="sf-card group block w-full text-left">{content}</div>
    )
  }

  const content = (
    <>
      <div className="aspect-[4/5] overflow-hidden bg-[var(--sf-paper-3)]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={stylist.photo?.altText || name}
            className="h-full w-full object-cover transition-transform duration-[var(--sf-dur-medium)] group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <User className="h-16 w-16 text-[var(--sf-ink-3)]" />
          </div>
        )}
      </div>
      <div className="p-[var(--sf-space-md)]">
        {tier ? <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] mb-1">{tier}</p> : null}
        <h3 className="sf-display text-[var(--sf-text-xl)] text-[var(--sf-ink)]">{name}</h3>
        {stylist.bio ? (
          <p className="mt-2 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)] line-clamp-2">{stylist.bio}</p>
        ) : null}
        {showSpecializations && stylist.specializations && stylist.specializations.length > 0 ? (
          <p className="mt-3 text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">
            {stylist.specializations
              .slice(0, 3)
              .map((s) => s.name)
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </>
  )

  return linked ? (
    <Link href={`/team/${stylist.id}`} className="sf-card group block overflow-hidden">
      {content}
    </Link>
  ) : (
    <div className="sf-card group block overflow-hidden">{content}</div>
  )
}
