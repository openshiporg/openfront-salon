import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, DollarSign, AlertCircle, Calendar, User, ArrowLeft } from "lucide-react"
import { getServiceById } from "../lib/data/services"
import { StylistCard } from "../components/StylistCard"

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>
}

export async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { id } = await params
  const service = await getServiceById(id)

  if (!service) {
    notFound()
  }

  const price = service.basePrice
  const duration = service.baseDuration
  const hasPricingTiers = service.pricingTier && Object.keys(service.pricingTier).length > 0
  const hasSpecialists = service.specialists && service.specialists.length > 0

  return (
    <div className="min-h-screen">
      {/* Back Button */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Services</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Service Image */}
            {service.image?.image?.url && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={service.image.image.url}
                  alt={service.image.altText || service.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Service Header */}
            <div>
              {service.category && (
                <div className="text-sm font-medium text-primary mb-2">
                  {service.category.name}
                </div>
              )}
              <h1 className="text-5xl font-bold mb-4">{service.name}</h1>
              <div className="flex items-center gap-6 text-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold text-2xl">${price}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {service.description && (
              <div className="prose prose-lg max-w-none">
                <h2 className="text-2xl font-semibold mb-4">About This Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </div>
            )}

            {/* Pricing Tiers */}
            {hasPricingTiers && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Pricing by Stylist Tier</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {Object.entries(service.pricingTier!).map(([tier, tierPrice]) => (
                    <div
                      key={tier}
                      className="p-4 border rounded-lg bg-card hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold capitalize">{tier} Stylist</div>
                          <div className="text-sm text-muted-foreground">{duration} min</div>
                        </div>
                        <div className="text-2xl font-bold">${tierPrice as number}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            {(service.requiresConsultation || service.requiresPatchTest) && (
              <div className="p-6 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                      Important Requirements
                    </h3>
                    <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                      {service.requiresConsultation && (
                        <li>• Complimentary consultation required before first appointment</li>
                      )}
                      {service.requiresPatchTest && (
                        <li>• Patch test required 24-48 hours before service</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Specialists */}
            {hasSpecialists && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Our Specialists</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {service.specialists.map((stylist) => (
                    <StylistCard
                      key={stylist.id}
                      stylist={stylist}
                      variant="compact"
                      showSpecializations={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border rounded-lg p-6 bg-card shadow-lg">
              <h3 className="text-2xl font-bold mb-6">Book This Service</h3>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-semibold">{duration} min</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-muted-foreground">Starting at</span>
                  <span className="font-bold text-2xl">${price}</span>
                </div>
                {hasSpecialists && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">Specialists</span>
                    <span className="font-semibold">{service.specialists.length}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/book?service=${service.id}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-4 text-lg font-medium hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                <Calendar className="h-5 w-5" />
                Book Appointment
              </Link>

              {hasSpecialists && (
                <div className="mt-4">
                  <Link
                    href="/team"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted transition-all"
                  >
                    <User className="h-4 w-4" />
                    View All Stylists
                  </Link>
                </div>
              )}

              <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong>Cancellation Policy:</strong> Cancel or reschedule up to 24 hours before your appointment.
                </p>
                <p>
                  Need help? Contact us at{" "}
                  <a href="tel:555-0123" className="text-primary hover:underline">
                    (555) 012-3456
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
