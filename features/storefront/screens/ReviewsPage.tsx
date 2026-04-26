import { Metadata } from "next"
import Link from "next/link"
import { Star, Quote } from "lucide-react"
import { getApprovedReviews } from "../lib/data/reviews"
import { formatDistanceToNow } from "date-fns"

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Reviews | Openfront Salon",
    description: "Read what our clients say about their experience at Openfront Salon",
  }
}

export async function ReviewsPage() {
  const reviews = await getApprovedReviews()

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0
  const totalReviews = reviews.length

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 to-primary/5 py-16 border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-4">Client Reviews</h1>
            <p className="text-xl text-muted-foreground mb-6">
              See what our clients are saying about their experience
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({totalReviews} reviews)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {reviews.length === 0 ? (
              <div className="text-center py-20 border rounded-lg bg-muted/30">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Reviews Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Be the first to share your experience with us!
                </p>
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-all"
                >
                  Book an Appointment
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reviews.map((review) => {
                  const timeAgo = formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })
                  const clientName = review.client?.user?.name || "Anonymous"
                  const serviceName = review.service?.name || ""
                  const stylistName = review.stylist?.user?.name || ""

                  return (
                    <div
                      key={review.id}
                      className="p-6 border rounded-lg bg-card hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="font-semibold text-lg">{clientName}</div>
                          <div className="text-sm text-muted-foreground">{timeAgo}</div>
                        </div>
                        <Quote className="h-8 w-8 text-primary/20" />
                      </div>

                      <div className="flex items-center gap-1 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>

                      {(serviceName || stylistName) && (
                        <div className="mb-3">
                          {serviceName && (
                            <span className="text-sm font-medium text-primary">{serviceName}</span>
                          )}
                          {stylistName && (
                            <span className="text-sm text-muted-foreground"> with {stylistName}</span>
                          )}
                        </div>
                      )}

                      {review.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          "{review.comment}"
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* CTA */}
            <div className="mt-12 text-center p-8 border rounded-lg bg-muted/30">
              <h3 className="text-2xl font-semibold mb-2">Experience It Yourself</h3>
              <p className="text-muted-foreground mb-6">
                Join our satisfied clients and book your appointment today
              </p>
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                Book an Appointment
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
