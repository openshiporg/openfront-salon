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
    description: brand.name ? `Client reviews for ${brand.name}.` : "Client reviews for the salon.",
  }
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="sf-stars" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => <Star key={index} className={index < rating ? "fill-current" : "opacity-25"} aria-hidden="true" />)}
    </span>
  )
}

export async function ReviewsPage() {
  const reviews = await getApprovedReviews()
  const averageRating = reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((review) => Math.round(review.rating) === stars).length }))

  return (
    <div className="sf-page-pad">
      <div className="sf-container">
        <PageIntro title={<>Client <em>reviews</em></>} size="large" />

        {reviews.length === 0 ? (
          <div className="sf-card-quiet flex flex-col items-center px-6 py-[var(--sf-space-2xl)] text-center">
            <Star className="mb-4 h-7 w-7 text-[var(--sf-ink-3)]" aria-hidden="true" />
            <h2 className="sf-display mb-6 text-[var(--sf-text-2xl)]">No reviews yet</h2>
            <div className="sf-track"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div>
          </div>
        ) : (
          <div className="grid gap-[var(--sf-space-xl)] lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="sf-display text-[var(--sf-text-display-s)]">{averageRating.toFixed(1)}</p>
              <div className="mt-2"><Stars rating={Math.round(averageRating)} /></div>
              <p className="mt-2 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
              <dl className="mt-6 grid gap-2">
                {distribution.map((row) => (
                  <div key={row.stars} className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[var(--sf-text-xs)]">
                    <dt className="font-semibold">{row.stars}★</dt>
                    <dd className="sf-bar"><span style={{ width: `${reviews.length ? (row.count / reviews.length) * 100 : 0}%` }} /></dd>
                    <dd className="text-right tabular-nums text-[var(--sf-ink-3)]">{row.count}</dd>
                  </div>
                ))}
              </dl>
              <div className="sf-track mt-8"><Link href="/book" className="sf-btn sf-btn-primary">Book an appointment</Link></div>
            </aside>

            <ul className="grid gap-4 md:grid-cols-2">
              {reviews.map((review) => {
                const serviceName = review.service?.name
                const stylistName = review.stylistName
                return (
                  <li key={review.id} className="sf-card flex flex-col gap-4 p-[var(--sf-space-md)]">
                    <div className="flex items-center justify-between gap-3">
                      <Stars rating={review.rating} />
                      <span className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</span>
                    </div>
                    {review.comment ? <blockquote className="sf-quote flex-1">&ldquo;{review.comment}&rdquo;</blockquote> : null}
                    <p className="text-[var(--sf-text-sm)]">
                      <span className="font-semibold">{review.reviewerName || "Client"}</span>
                      {serviceName || stylistName ? <span className="text-[var(--sf-ink-3)]"> · {serviceName}{serviceName && stylistName ? " with " : ""}{stylistName}</span> : null}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
