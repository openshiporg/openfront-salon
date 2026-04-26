import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Award, Clock, Star } from "lucide-react"
import { getStylistById } from "../lib/data/stylists"
import { calculateYearsExperience, getTierDisplayName } from "../lib/utils/stylist-helpers"

interface StylistDetailPageProps {
  params: Promise<{ id: string }>
}

export async function StylistDetailPage({ params }: StylistDetailPageProps) {
  const { id } = await params
  const stylist = await getStylistById(id)

  if (!stylist) {
    notFound()
  }

  const name = stylist.user?.name || "Stylist"
  const photoUrl = stylist.photo?.image?.url
  const yearsExperience = calculateYearsExperience(stylist.hireDate)
  const tierName = getTierDisplayName(stylist.tier || "junior")

  // Get available days
  const availableDays = stylist.schedules
    ? stylist.schedules
        .filter(s => s.isAvailable)
        .map(s => {
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
          return days[s.dayOfWeek]
        })
    : []

  return (
    <div className="min-h-screen">
      {/* Back Button */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/team"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Team</span>
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-8">
              {/* Photo */}
              <div className="shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={stylist.photo?.altText || name}
                    className="w-64 h-64 rounded-lg object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-64 h-64 rounded-lg bg-muted flex items-center justify-center shadow-lg">
                    <Award className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
                  {tierName}
                </div>
                <h1 className="text-5xl font-bold mb-4">{name}</h1>
                <div className="flex flex-wrap items-center gap-6 text-muted-foreground mb-6">
                  {yearsExperience > 0 && (
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      <span>{yearsExperience} years experience</span>
                    </div>
                  )}
                  {stylist.specializations && stylist.specializations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      <span>{stylist.specializations.length} specializations</span>
                    </div>
                  )}
                </div>

                {stylist.bio && (
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {stylist.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Certifications */}
            {stylist.certifications && (
              <div className="p-6 border rounded-lg bg-card">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <Award className="h-6 w-6 text-primary" />
                  Certifications & Training
                </h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {stylist.certifications}
                </p>
              </div>
            )}

            {/* Specializations */}
            {stylist.specializations && stylist.specializations.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Specializations</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {stylist.specializations.map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.id}`}
                      className="group p-4 border rounded-lg bg-card hover:shadow-lg hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Star className="h-5 w-5 text-primary" />
                        </div>
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {service.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Availability */}
            {availableDays.length > 0 && (
              <div className="p-6 border rounded-lg bg-card">
                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-6 w-6 text-primary" />
                  Availability
                </h2>
                <div className="flex flex-wrap gap-2">
                  {availableDays.map((day) => (
                    <span
                      key={day}
                      className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium"
                    >
                      {day}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Specific time slots available during booking
                </p>
              </div>
            )}
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 border rounded-lg p-6 bg-card shadow-lg">
              <h3 className="text-2xl font-bold mb-6">Book with {name}</h3>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-semibold">{tierName}</span>
                </div>
                {yearsExperience > 0 && (
                  <div className="flex items-center justify-between py-3 border-b">
                    <span className="text-muted-foreground">Experience</span>
                    <span className="font-semibold">{yearsExperience} years</span>
                  </div>
                )}
                {stylist.specializations && (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-muted-foreground">Services</span>
                    <span className="font-semibold">{stylist.specializations.length}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/book?stylist=${stylist.id}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-4 text-lg font-medium hover:bg-primary/90 transition-all shadow-md hover:shadow-lg mb-4"
              >
                <Calendar className="h-5 w-5" />
                Book Appointment
              </Link>

              <Link
                href="/services"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted transition-all"
              >
                View All Services
              </Link>

              <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
                <p>
                  <strong>Tip:</strong> Book early for preferred time slots with {name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
