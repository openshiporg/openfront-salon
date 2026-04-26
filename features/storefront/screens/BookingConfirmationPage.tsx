import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, Calendar, User, Clock, Mail, Phone, MapPin, ArrowRight } from "lucide-react"
import { getAppointmentById } from "../lib/data/appointments"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const appointment = await getAppointmentById(id)

  if (!appointment) {
    return {
      title: "Booking Not Found",
      description: "The requested booking could not be found.",
    }
  }

  return {
    title: `Booking Confirmation - ${appointment.service?.name || 'Appointment'}`,
    description: `Your appointment for ${appointment.service?.name} has been confirmed.`,
  }
}

export async function BookingConfirmationPage({ params }: Props) {
  const { id } = await params
  const appointment = await getAppointmentById(id)

  if (!appointment) {
    notFound()
  }

  const appointmentDate = new Date(appointment.appointmentDate)
  const service = appointment.service
  const stylist = appointment.stylist
  const client = appointment.client

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Success Header */}
          <div className="bg-card border rounded-lg shadow-xl p-8 md:p-12 text-center mb-8">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Booking Confirmed!</h1>
            <p className="text-xl text-muted-foreground mb-2">
              Your appointment has been successfully scheduled.
            </p>
            {client?.email && (
              <p className="text-sm text-muted-foreground">
                A confirmation email has been sent to <span className="font-semibold text-foreground">{client.email}</span>
              </p>
            )}
          </div>

          {/* Appointment Details */}
          <div className="bg-card border rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Appointment Details</h2>

            <div className="space-y-6">
              {/* Service */}
              <div className="flex items-start gap-4 pb-6 border-b">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-1">{service?.name}</div>
                  <div className="text-muted-foreground">
                    {service?.baseDuration} minutes
                  </div>
                  <div className="text-lg font-bold text-primary mt-2">
                    ${service?.basePrice}
                  </div>
                </div>
              </div>

              {/* Stylist */}
              <div className="flex items-start gap-4 pb-6 border-b">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-1">{stylist?.user?.name}</div>
                  <div className="text-muted-foreground capitalize">
                    {stylist?.tier} Stylist
                  </div>
                  {stylist?.specialties && stylist.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {stylist.specialties.slice(0, 3).map((specialty: string) => (
                        <span
                          key={specialty}
                          className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-start gap-4 pb-6 border-b">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-1">
                    {appointmentDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {appointmentDate.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true
                    })}
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-2">Contact Information</div>
                  <div className="space-y-1 text-muted-foreground">
                    {client?.name && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{client.name}</span>
                      </div>
                    )}
                    {client?.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{client.email}</span>
                      </div>
                    )}
                    {client?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {appointment.clientNotes && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="font-semibold mb-2">Your Notes</div>
                  <p className="text-muted-foreground">{appointment.clientNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location Info */}
          <div className="bg-card border rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-xl font-bold mb-4">Location</h2>
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold mb-1">Openfront Salon</div>
                <div className="text-muted-foreground text-sm">
                  123 Beauty Boulevard<br />
                  Suite 100<br />
                  New York, NY 10001
                </div>
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-2"
                >
                  Get Directions
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Important Information */}
          <div className="bg-muted/50 border rounded-lg p-6 mb-8">
            <h3 className="font-semibold mb-3">Important Information</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Please arrive 10 minutes early for your appointment</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>If you need to cancel or reschedule, please contact us at least 24 hours in advance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Bring any hair or product inspiration photos you&apos;d like to share</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Payment is accepted via cash, credit card, or digital payment</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-all shadow-md"
            >
              Back to Home
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-lg border-2 border-border px-8 py-3 font-medium hover:bg-muted transition-all"
            >
              View My Appointments
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-lg border-2 border-border px-8 py-3 font-medium hover:bg-muted transition-all"
            >
              Book Another
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
