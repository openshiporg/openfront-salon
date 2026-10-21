import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Calendar, Check, Clock, Mail, MapPin, Phone, User } from "lucide-react"
import { getAppointmentById } from "../lib/data/appointments"
import { formatPrice } from "../lib/format-price"

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
    title: `Booking — ${appointment.service?.name || "Appointment"}`,
    description: `Appointment details for ${appointment.service?.name || "your visit"}.`,
  }
}

export async function BookingConfirmationPage({ params }: Props) {
  const { id } = await params
  const appointment = await getAppointmentById(id)

  if (!appointment) {
    notFound()
  }

  const appointmentDate = new Date(appointment.startTime)
  const stylist = appointment.stylist
  const client = appointment.client
  const appointmentLocation = appointment.location
  const appointmentAddress = appointmentLocation
    ? [appointmentLocation.address, [appointmentLocation.city, appointmentLocation.state].filter(Boolean).join(", "), appointmentLocation.zipCode].filter(Boolean).join(" ")
    : null

  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-card p-8 md:p-10 text-center mb-[var(--sf-space-md)]">
          <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center border border-[var(--sf-rule)] bg-[var(--sf-paper-2)]">
            <Check className="h-7 w-7 text-[var(--sf-accent)]" />
          </div>
          <h1 className="sf-display text-[var(--sf-text-display-s)] mb-3">Booking received</h1>
          <p className="text-[var(--sf-text-md)] text-[var(--sf-ink-2)]">
            Your appointment request has been received.
          </p>
          {client?.email ? (
            <p className="mt-2 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">
              Account email: <span className="text-[var(--sf-ink)]">{client.email}</span>
            </p>
          ) : null}
        </div>

        <div className="sf-card p-[var(--sf-space-md)] mb-[var(--sf-space-md)]">
          <h2 className="sf-display text-[var(--sf-text-xl)] mb-6">Appointment details</h2>
          <dl className="space-y-5 text-[var(--sf-text-sm)]">
            <div className="flex gap-4 pb-5 border-b border-[var(--sf-rule)]">
              <Clock className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
              <div>
                <dt className="sr-only">Service</dt>
                <dd className="font-medium text-[var(--sf-text-md)]">{appointment.services.map(item => item.name).join(", ") || "Service snapshot unavailable"}</dd>
                <p className="text-[var(--sf-ink-3)] mt-1">
                  {appointment.services.length ? `${appointment.duration} min · ${formatPrice(appointment.services.reduce((sum, item) => sum + item.basePrice, 0))}` : "Price unavailable"}
                </p>

              </div>
            </div>

            <div className="flex gap-4 pb-5 border-b border-[var(--sf-rule)]">
              <User className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
              <div>
                <dt className="sr-only">Artist</dt>
                <dd className="font-medium">{stylist?.user?.name || "To be assigned"}</dd>
                <p className="text-[var(--sf-ink-3)] capitalize mt-1">{stylist?.tier} artist</p>
              </div>
            </div>

            <div className="flex gap-4 pb-5 border-b border-[var(--sf-rule)]">
              <Calendar className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
              <div>
                <dt className="sr-only">Date and time</dt>
                <dd className="font-medium">
                  {appointmentDate.toLocaleDateString("en-US", {
                    timeZone: appointmentLocation?.timezone || "UTC",
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
                <p className="text-[var(--sf-ink-3)] mt-1">
                  {appointmentDate.toLocaleTimeString("en-US", {
                    timeZone: appointmentLocation?.timezone || "UTC",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Mail className="h-5 w-5 shrink-0 text-[var(--sf-accent)] mt-0.5" />
              <div>
                <dt className="font-medium mb-2">Contact</dt>
                <dd className="space-y-1 text-[var(--sf-ink-2)]">
                  {client?.name ? <p>{client.name}</p> : null}
                  {client?.email ? <p>{client.email}</p> : null}
                  {client?.phone ? (
                    <p className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {client.phone}
                    </p>
                  ) : null}
                </dd>
              </div>
            </div>
          </dl>

          {appointment.clientNotes ? (
            <div className="mt-6 pt-5 border-t border-[var(--sf-rule)]">
              <p className="text-[var(--sf-text-xs)] text-[var(--sf-ink-3)] mb-1">Your notes</p>
              <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">{appointment.clientNotes}</p>
            </div>
          ) : null}
        </div>

        {appointmentLocation ? (
          <div className="sf-card p-[var(--sf-space-md)] mb-[var(--sf-space-md)]">
            <h2 className="sf-display text-[var(--sf-text-lg)] mb-3">Appointment location</h2>
            <div className="flex gap-3 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--sf-accent)] mt-0.5" />
              <p>
                <span className="font-medium text-[var(--sf-ink)]">{appointmentLocation.name}</span>
                {appointmentAddress ? <><br />{appointmentAddress}</> : null}
              </p>
            </div>
          </div>
        ) : (
          <p role="status" className="mb-[var(--sf-space-md)] border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-[var(--sf-space-md)] text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
            The appointment record does not currently include a published location. Contact the salon before traveling.
          </p>
        )}



        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="sf-btn sf-btn-primary">
            Home
          </Link>
          <Link href="/account" className="sf-btn sf-btn-secondary">
            My appointments
          </Link>
          <Link href="/book" className="sf-btn sf-btn-secondary">
            Book another
          </Link>
        </div>
      </div>
    </div>
  )
}
