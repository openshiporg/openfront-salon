import { Metadata } from "next"
import { storefrontTitle } from "../lib/data/brand"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check } from "lucide-react"
import { getAppointmentById } from "../lib/data/appointments"
import { formatMenuPrice } from "../lib/format-price"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const appointment = await getAppointmentById(id)

  if (!appointment) return { title: await storefrontTitle("Page not found"), description: "Page not found" }

  return {
    title: await storefrontTitle(`Booking · ${appointment.service?.name || "Appointment"}`),
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

  const zone = appointmentLocation?.timezone || "UTC"
  const dateLabel = appointmentDate.toLocaleDateString("en-US", { timeZone: zone, weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const timeLabel = appointmentDate.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true })

  return (
    <div className="sf-page-pad">
      <div className="sf-container-narrow">
        <div className="sf-carton" data-band="ink" data-selected="true">
          <div className="sf-carton-band"><span className="sf-tick"><Check aria-hidden="true" /></span></div>
          <div className="px-[var(--sf-space-sm)] pb-3 pt-[var(--sf-space-sm)] md:px-[var(--sf-space-md)]">
            <h1 className="sf-display text-[length:var(--sf-text-3xl)]">Booking received</h1>
            {client?.email ? <p className="mt-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Account email: <span className="font-semibold text-[var(--sf-ink)]">{client.email}</span></p> : null}
          </div>
          <dl className="border-t border-[var(--sf-ink)] px-[var(--sf-space-sm)] py-1 md:px-[var(--sf-space-md)]">
            <div className="sf-summary-row"><dt>Service</dt><dd>{appointment.services.map(item => item.name).join(", ") || "Service snapshot unavailable"}</dd></div>
            <div className="sf-summary-row"><dt>Stylist</dt><dd>{stylist?.user?.name || "To be assigned"}</dd></div>
            <div className="sf-summary-row"><dt>Date</dt><dd>{dateLabel}</dd></div>
            <div className="sf-summary-row"><dt>Time</dt><dd>{timeLabel}</dd></div>
            <div className="sf-summary-row"><dt>Duration</dt><dd>{appointment.duration} min</dd></div>
            <div className="sf-summary-row"><dt>Price</dt><dd>{appointment.services.length ? formatMenuPrice(appointment.services.reduce((sum, item) => sum + item.basePrice, 0)) : "Price unavailable"}</dd></div>
          </dl>
          <div className="grid gap-4 border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)] text-[length:var(--sf-text-sm)] sm:grid-cols-2 md:p-[var(--sf-space-md)]">
            <div>
              <h2 className="mb-1 font-semibold text-[var(--sf-ink-3)]">Location</h2>
              {appointmentLocation ? (
                <p><span className="font-semibold">{appointmentLocation.name}</span>{appointmentAddress ? <><br /><span className="text-[var(--sf-ink-2)]">{appointmentAddress}</span></> : null}</p>
              ) : <p role="status" className="text-[var(--sf-ink-2)]">No published location. Contact the salon before traveling.</p>}
            </div>
            <div className="min-w-0">
              <h2 className="mb-1 font-semibold text-[var(--sf-ink-3)]">Contact</h2>
              {client?.name ? <p className="font-semibold">{client.name}</p> : null}
              {client?.email ? <p className="break-all text-[var(--sf-ink-2)]">{client.email}</p> : null}
              {client?.phone ? <p className="text-[var(--sf-ink-2)]">{client.phone}</p> : null}
            </div>
          </div>
          {appointment.clientNotes ? (
            <div className="border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
              <h2 className="mb-1 text-[length:var(--sf-text-sm)] font-semibold text-[var(--sf-ink-3)]">Your notes</h2>
              <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{appointment.clientNotes}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-[var(--sf-space-md)]">
          <div className="sf-track">
            <Link href="/account" className="sf-btn sf-btn-primary">My appointments</Link>
            <Link href="/book" className="sf-btn sf-btn-quiet">Book another</Link>
            <Link href="/" className="sf-btn sf-btn-quiet">Home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
