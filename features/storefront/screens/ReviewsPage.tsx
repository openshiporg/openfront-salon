import { Metadata } from "next"
import Link from "next/link"
import { Star } from "lucide-react"
import { getApprovedReviews } from "../lib/data/reviews"
import { formatDistanceToNow } from "date-fns"
import { PageIntro } from "../components/ui/PageIntro"
import { getStorefrontBrand, storefrontTitle } from "../lib/data/brand"

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand()
  return {
    title: await storefrontTitle("Reviews"),
    description: brand.name ? `Client reviews from the ${brand.name} booking experience.` : "Client reviews from the salon booking experience.",
  }
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < rating ? "fill-[var(--sf-accent)] text-[var(--sf-accent)]" : "text-[var(--sf-rule)]"
          }`}
        />
      ))}
    </div>
  )
}

export async function ReviewsPage() {
  const reviews = await getApprovedReviews()
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro
          title="Client reviews"
          description={
            reviews.length > 0
              ? `${reviews.length} approved ${reviews.length === 1 ? "review" : "reviews"} — average ${averageRating.toFixed(1)} stars.`
              : "Approved client reviews will appear here as they are published."
          }
          size="large"
        />

        {reviews.length === 0 ? (
          <div className="text-center py-[var(--sf-space-2xl)] border border-[var(--sf-rule)]">
            <Star className="h-8 w-8 mx-auto mb-4 text-[var(--sf-ink-3)]" />
            <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">No reviews yet</h2>

            <Link href="/book" className="sf-btn sf-btn-primary">
              Reserve a visit
            </Link>
          </div>
        ) : (
          <ul className="grid gap-[var(--sf-space-md)] md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => {
              const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })
              const clientName = review.reviewerName || "Client"
              const serviceName = review.service?.name
              const stylistName = review.stylistName

              return (
                <li key={review.id} className="sf-card p-[var(--sf-space-md)] flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-[var(--sf-ink)]">{clientName}</p>
                      <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">{timeAgo}</p>
                    </div>
                    <StarRow rating={review.rating} />
                  </div>

                  {(serviceName || stylistName) && (
                    <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] mb-3">
                      {serviceName}
                      {serviceName && stylistName ? " with " : ""}
                      {stylistName}
                    </p>
                  )}

                  {review.comment ? (
                    <blockquote className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)] leading-relaxed flex-1">
                      &ldquo;{review.comment}&rdquo;
                    </blockquote>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {reviews.length > 0 ? (
          <div className="mt-[var(--sf-space-xl)] pt-[var(--sf-space-lg)] border-t border-[var(--sf-rule)] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="sf-display text-[clamp(1.35rem,2.5vw,1.85rem)]">Appointments</p>
            <Link href="/book" className="sf-btn sf-btn-primary shrink-0">
              Reserve online
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
