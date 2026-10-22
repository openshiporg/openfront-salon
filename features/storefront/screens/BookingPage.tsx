"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, ChevronLeft, Clock3, ShieldCheck } from "lucide-react"
import type { Service } from "../lib/data/services"
import { getStylistsForService } from "../lib/data/stylists"
import type { Stylist } from "../lib/data/stylists"
import { createAppointment } from "../lib/data/appointments"
import { getBookingContext } from "../lib/data/booking-context"
import { getAvailableTimeSlots, type BookingSlot } from "../lib/data/availability"
import { clearBookingRequestKey, getOrCreateBookingRequestKey } from "../lib/data/bookingSubmitOutcome"
import type { BookingContextRead, BookingSelectionRead } from "../lib/data/bookingSelectionRead"
import { serviceTags } from "../components/ServiceCard"
import { StylistPortrait, tierLabels } from "../components/StylistCard"
import { TimeSlotPicker } from "../components/TimeSlotPicker"
import { BookingStepIndicator } from "../components/BookingStepIndicator"
import { formatMenuPrice } from "../lib/format-price"

interface ClientInfo {
  name: string
  email: string
  phone: string
  notes: string
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

const STEPS = [
  { number: 1, title: "Service" },
  { number: 2, title: "Stylist" },
  { number: 3, title: "Time" },
  { number: 4, title: "Details" }
]
const EMPTY_SERVICES: Service[] = []

interface BookingPageProps {
  initialServiceCatalog: BookingSelectionRead<Service>
  preselectedService?: string | null
  preselectedStylist?: string | null
}

type StylistReadState =
  | { status: "idle" | "loading" | "unavailable" }
  | { status: "available"; items: Stylist[] }

function formatNotice(minutes?: number | null) {
  const value = Math.max(0, Math.round(Number(minutes) || 0))
  if (value % 1440 === 0 && value > 0) return `${value / 1440} ${value === 1440 ? "day" : "days"}`
  if (value % 60 === 0) return `${value / 60} ${value === 60 ? "hour" : "hours"}`
  return `${value} minutes`
}

export function BookingPage({ initialServiceCatalog, preselectedService = null, preselectedStylist = null }: BookingPageProps) {

  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<string | null>(preselectedService)
  const [selectedStylist, setSelectedStylist] = useState<string | null>(preselectedStylist)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  })

  // Data state
  const services = initialServiceCatalog.status === "available" ? initialServiceCatalog.items : EMPTY_SERVICES
  const [stylistRead, setStylistRead] = useState<StylistReadState>({ status: "idle" })
  const [stylistRetryAttempt, setStylistRetryAttempt] = useState(0)
  const stylists = stylistRead.status === "available" ? stylistRead.items : []
  const [availableSlots, setAvailableSlots] = useState<BookingSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingOutcomeUnresolved, setBookingOutcomeUnresolved] = useState(false)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingContextRead, setBookingContextRead] = useState<BookingContextRead | null>(null)
  const [bookingContextAttempt, setBookingContextAttempt] = useState(0)
  const bookingContext = bookingContextRead?.status === "available" ? bookingContextRead.data : null
  const [locationId, setLocationId] = useState("")
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [requestKey, setRequestKey] = useState<string | null>(null)
  const [requestKeyUnavailable, setRequestKeyUnavailable] = useState(false)
  useEffect(() => {
    try {
      const key = getOrCreateBookingRequestKey(window.sessionStorage, () => crypto.randomUUID())
      setRequestKey(key)
      setRequestKeyUnavailable(key === null)
    } catch {
      setRequestKey(null)
      setRequestKeyUnavailable(true)
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    setBookingContextRead(null)
    async function loadBookingContext() {
      try {
        const result = await getBookingContext()
        if (cancelled) return
        setBookingContextRead(result)
        if (result.status === "available") {
          setLocationId(current => result.data.locations.length === 1
            ? result.data.locations[0].id
            : result.data.locations.some(location => location.id === current) ? current : "")
          if (result.data.client) setClientInfo(info => ({ ...info, name: result.data.client!.name, email: result.data.client!.email, phone: result.data.client!.phone || "" }))
        } else {
          setLocationId("")
        }
      } catch {
        if (!cancelled) setBookingContextRead({ status: "unavailable" })
      }
    }
    void loadBookingContext()
    return () => { cancelled = true }
  }, [bookingContextAttempt])

  // Auto-advance only for a verified current catalog entry; discard stale URL choices.
  useEffect(() => {
    if (!preselectedService || selectedService !== preselectedService || initialServiceCatalog.status !== "available") return
    if (services.some((service) => service.id === preselectedService)) {
      setStep(2)
      return
    }
    setSelectedService(null)
    setSelectedStylist(null)
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])
    setStep(1)
  }, [preselectedService, selectedService, initialServiceCatalog.status, services])

  // A stylist chosen before the service (e.g. "Book with …") skips the stylist step once qualified.
  useEffect(() => {
    if (step === 2 && selectedStylist && stylistRead.status === "available") setStep(3)
  }, [step, selectedStylist, stylistRead.status])

  // Fetch and validate service-qualified stylists; ignore stale responses after a service change.
  useEffect(() => {
    let cancelled = false
    if (!selectedService) {
      setStylistRead({ status: "idle" })
      return () => { cancelled = true }
    }

    setStylistRead({ status: "loading" })
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])

    async function fetchStylists(serviceId: string) {
      try {
        const result = await getStylistsForService(serviceId)
        if (cancelled) return
        if (result.status === "unavailable") {
          setStylistRead({ status: "unavailable" })
          setSelectedStylist(null)
          return
        }
        setStylistRead({ status: "available", items: result.items })
        setSelectedStylist(current => current && result.items.some(stylist => stylist.id === current) ? current : null)
      } catch {
        if (cancelled) return
        setStylistRead({ status: "unavailable" })
        setSelectedStylist(null)
      }
    }
    void fetchStylists(selectedService)
    return () => { cancelled = true }
  }, [selectedService, stylistRetryAttempt])

  // Fetch available time slots when stylist and date are selected
  useEffect(() => {
    let cancelled = false

    async function fetchSlots() {
      if (!selectedStylist || !selectedDate || !selectedService || !locationId) {
        setAvailableSlots([])
        return
      }

      setLoadingSlots(true)
      try {
        const service = services.find((s) => s.id === selectedService)
        const duration = service?.baseDuration || 60
        const dateStr = localDateKey(selectedDate)
        const slots = await getAvailableTimeSlots(selectedStylist, dateStr, duration, selectedService, locationId)
        if (cancelled) return
        setAvailableSlots(slots)
        setSelectedTime((current) => current && slots.some((slot) => slot.startTime === current) ? current : null)
      } catch (err) {
        if (cancelled) return
        console.error("Failed to fetch time slots:", err)
        setError("Availability could not be checked. Please retry or contact the salon.")
        setAvailableSlots([])
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    }
    fetchSlots()
    return () => {
      cancelled = true
    }
  }, [selectedStylist, selectedDate, selectedService, services, locationId])

  const service = services.find((s) => s.id === selectedService)
  const stylist = stylists.find((s) => s.id === selectedStylist)
  const selectedTimeLabel = availableSlots.find((slot) => slot.startTime === selectedTime)?.label || null

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId)
    setStylistRead({ status: "loading" })
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])
    setStep(2)
    setError(null)
  }

  const handleStylistSelect = (stylistId: string) => {
    setSelectedStylist(stylistId)
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])
    setStep(3)
    setError(null)
  }

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date)
    setSelectedTime(null)
    setAvailableSlots([])
    setError(null)
  }

  const handleDateTimeConfirm = () => {
    if (selectedDate && selectedTime) {
      setStep(4)
      setError(null)
    }
  }

  const submitBooking = async () => {
    if (!requestKey) return
    setSubmitting(true)
    setError(null)

    try {
      // The server returns an exact ISO instant in the salon's timezone.
      const result = await createAppointment({
        locationId,
        policyAccepted,
        policyVersion: bookingContext?.policy.version,
        requestKey,
        startTime: selectedTime!,
        stylistId: selectedStylist!,
        serviceIds: [selectedService!],
        clientName: clientInfo.name,
        clientEmail: clientInfo.email,
        clientPhone: clientInfo.phone,
        clientNotes: clientInfo.notes || undefined,
      })

      if (result.status === "unresolved") {
        setBookingOutcomeUnresolved(true)
        return
      }
      setBookingOutcomeUnresolved(false)
      if (result.status === "rejected") {
        setError(result.error)
        return
      }

      try {
        clearBookingRequestKey(window.sessionStorage)
      } catch {
        // A confirmed booking is still confirmed if browser storage is unavailable.
      }
      setBookingId(result.appointmentId)
      setBookingSuccess(true)
    } catch {
      setBookingOutcomeUnresolved(true)
      setError(null)
    } finally {
      setSubmitting(false)
    }
  }

  // Revisiting a step clears what depends on it, matching the "Change" links.
  const handleStepSelect = (target: number) => {
    if (target >= step) return
    if (target === 2) setSelectedStylist(null)
    setStep(target)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitBooking()
  }

  const location = bookingContext?.locations.find((item) => item.id === locationId)
  const dateLabel = selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const servicesByCategory = services.reduce<Array<{ name: string; items: Service[] }>>((groups, item) => {
    const name = item.category?.name || "Services"
    const group = groups.find((entry) => entry.name === name)
    if (group) group.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])

  const summary = (
    <dl className="px-[var(--sf-space-md)] py-2">
      <div className="sf-summary-row"><dt>Service</dt><dd>{service?.name || "—"}</dd></div>
      <div className="sf-summary-row"><dt>Stylist</dt><dd>{stylist?.user?.name || "—"}</dd></div>
      <div className="sf-summary-row"><dt>Date</dt><dd>{dateLabel || "—"}</dd></div>
      <div className="sf-summary-row"><dt>Time</dt><dd>{selectedTimeLabel || "—"}</dd></div>
      {location ? <div className="sf-summary-row"><dt>Location</dt><dd>{location.name}</dd></div> : null}
    </dl>
  )

  // Success screen
  if (bookingSuccess) {
    return (
      <div className="sf-page-pad">
        <div className="sf-container-narrow">
          <div className="sf-ticket overflow-hidden">
            <div className="p-[var(--sf-space-md)] text-center md:p-[var(--sf-space-lg)]">
              <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sf-ink)] text-[var(--sf-accent-ink)]"><Check className="h-6 w-6" aria-hidden="true" /></span>
              <h1 className="sf-display text-[var(--sf-text-display-s)]">Booking <em>received</em></h1>
              <p className="mt-3 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Confirmation to <span className="font-semibold text-[var(--sf-ink)]">{clientInfo.email}</span></p>
            </div>
            <div className="sf-ticket-perf" />
            {summary}
            <dl className="border-t border-[var(--sf-rule)] px-[var(--sf-space-md)] py-2">
              <div className="sf-summary-row"><dt>Price</dt><dd>{formatMenuPrice(service?.basePrice)}</dd></div>
              <div className="sf-summary-row"><dt>Reference</dt><dd className="font-mono !text-[var(--sf-text-xs)]">{bookingId}</dd></div>
            </dl>
            <div className="grid gap-4 p-[var(--sf-space-md)] text-center">
              {bookingContext?.client ? <Link className="sf-link text-[var(--sf-text-sm)]" href={`/booking/${bookingId}`}>View your saved appointment</Link> : <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">To change this booking, contact the salon.</p>}
              <div className="sf-track mx-auto">
                <Link href="/" className="sf-btn sf-btn-primary">Home</Link>
                <a href="/book" className="sf-btn sf-btn-quiet">Book another</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-page-pad !pt-[var(--sf-space-lg)]">
      <div className="sf-container">
        <div className="mb-[var(--sf-space-lg)] flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h1 className="sf-display text-[var(--sf-text-display-s)]">Book an <em>appointment</em></h1>
          <Link className="sf-link text-[var(--sf-text-sm)]" href="/account">{bookingContext?.client ? `Signed in as ${bookingContext.client.name}` : "Client sign in"}</Link>
        </div>

        <div className="sf-booking-grid">
          <div className="min-w-0">
            <div className="mb-[var(--sf-space-md)]">
              <BookingStepIndicator currentStep={step} steps={STEPS} onSelect={bookingOutcomeUnresolved ? undefined : handleStepSelect} />
            </div>

            {bookingContextRead === null ? <p role="status" className="sf-note mb-4">Loading booking locations and policy…</p> : null}
            {bookingContextRead?.status === "unavailable" ? <div role="alert" className="sf-alert mb-4">Booking configuration could not be verified. No reservation can be submitted. <button type="button" className="sf-link ml-1" onClick={() => setBookingContextAttempt(attempt => attempt + 1)}>Retry booking details</button></div> : null}
            {bookingContextRead?.status === "available" && bookingContextRead.data.locations.length === 0 ? <p role="status" className="sf-note mb-4">No salon locations are available for online booking. Contact the salon.</p> : null}
            {requestKeyUnavailable ? <p role="alert" className="sf-alert mb-4">Online booking needs site storage. Enable it in your browser and reload, or contact the salon.</p> : null}
            {bookingContext && bookingContext.locations.length > 1 ? (
              <label className="sf-field mb-[var(--sf-space-md)] max-w-md">Location
                <select className="sf-input" value={locationId} onChange={event => { setLocationId(event.target.value); setSelectedTime(null); setAvailableSlots([]) }} required>
                  <option value="">Choose a location</option>{bookingContext.locations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.timezone || "Timezone unavailable"}</option>)}
                </select>
              </label>
            ) : null}
            {error ? <div role="alert" className="sf-alert mb-4">{error}</div> : null}

            {bookingOutcomeUnresolved ? (
              <div role="alert" className="sf-card grid gap-4 p-[var(--sf-space-md)]">
                <h2 className="sf-display text-[var(--sf-text-2xl)]">We couldn&apos;t confirm your booking request</h2>
                <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Retry below; it won&apos;t be booked twice. If it&apos;s still unclear, check your email or contact the salon.</p>
                <div className="sf-track justify-self-start">
                  <button type="button" className="sf-btn sf-btn-primary" disabled={submitting || !requestKey} onClick={() => void submitBooking()}>
                    {submitting ? "Checking request…" : "Retry same booking request"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {step === 1 && (
                  <section aria-labelledby="step-service">
                    <h2 id="step-service" className="sf-display mb-4 text-[var(--sf-text-2xl)]">Choose a service</h2>
                    {initialServiceCatalog.status === "unavailable" ? (
                      <div role="alert" className="sf-alert">
                        Service choices could not be verified. No service can be selected until the catalog loads.
                        <button type="button" className="sf-link ml-1" onClick={() => window.location.reload()}>Retry service catalog</button>
                      </div>
                    ) : services.length === 0 ? (
                      <p role="status" className="sf-note">No services are available for online booking. Contact the salon.</p>
                    ) : (
                      <div className="grid gap-[var(--sf-space-lg)]">
                        {servicesByCategory.map((group) => (
                          <div key={group.name}>
                            {servicesByCategory.length > 1 ? <h3 className="sf-eyebrow mb-1">{group.name}</h3> : null}
                            <div className="sf-menu">
                              {group.items.map((svc) => {
                                const tags = serviceTags(svc)
                                return (
                                  <button key={svc.id} type="button" aria-pressed={selectedService === svc.id} onClick={() => handleServiceSelect(svc.id)} className="sf-menu-row sf-menu-select">
                                    <span className="min-w-0">
                                      <span className="sf-menu-name"><span className="sf-menu-title">{svc.name}</span></span>
                                      {svc.description ? <span className="sf-menu-desc line-clamp-2 block">{svc.description}</span> : null}
                                      <span className="sf-menu-meta">
                                        <span className="sf-chip"><Clock3 aria-hidden="true" />{svc.baseDuration} min</span>
                                        {tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}
                                      </span>
                                    </span>
                                    <span className="sf-menu-price">{formatMenuPrice(svc.basePrice)}</span>
                                    <span className="hidden md:block"><ChevronRight className="h-5 w-5 text-[var(--sf-ink-3)]" aria-hidden="true" /></span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {step === 2 && (
                  <section aria-labelledby="step-stylist">
                    <h2 id="step-stylist" className="sf-display mb-1 text-[var(--sf-text-2xl)]">Choose a stylist</h2>
                    <p className="mb-5 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{service?.name}</p>
                    {stylistRead.status === "loading" || stylistRead.status === "idle" ? <p role="status" className="sf-note">Loading stylists…</p> : null}
                    {stylistRead.status === "unavailable" ? <div role="alert" className="sf-alert">Stylist choices could not be verified. No stylist is selected. <button type="button" className="sf-link ml-1" onClick={() => setStylistRetryAttempt(attempt => attempt + 1)}>Retry stylist list</button></div> : null}
                    {stylistRead.status === "available" && stylists.length === 0 ? <p role="status" className="sf-note">No stylists are available for this service. Contact the salon.</p> : null}
                    {stylistRead.status === "available" && stylists.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {stylists.map((styl) => (
                          <button key={styl.id} type="button" aria-pressed={selectedStylist === styl.id} onClick={() => handleStylistSelect(styl.id)} className="sf-pick">
                            <StylistPortrait stylist={styl} className="h-20 w-16 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="sf-display block truncate text-[var(--sf-text-lg)]">{styl.user?.name || "Stylist"}</span>
                              {styl.tier ? <span className="block text-[var(--sf-text-xs)] text-[var(--sf-ink-3)]">{tierLabels[styl.tier] || styl.tier}</span> : null}
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--sf-ink-3)]" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="step-time">
                    <h2 id="step-time" className="sf-display mb-1 text-[var(--sf-text-2xl)]">Pick a time</h2>
                    <p className="mb-5 text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{service?.name} · {stylist?.user?.name}</p>
                    <TimeSlotPicker
                      selectedDate={selectedDate}
                      onDateSelect={handleDateSelect}
                      selectedTime={selectedTime}
                      onTimeSelect={setSelectedTime}
                      availableSlots={availableSlots}
                      loadingSlots={loadingSlots}
                    />
                    <div className="mt-[var(--sf-space-md)] flex justify-end">
                      <div className="sf-track">
                        <button type="button" onClick={handleDateTimeConfirm} disabled={!selectedDate || !selectedTime} className="sf-btn sf-btn-primary">
                          Continue
                          <ChevronRight />
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {step === 4 && (
                  <form onSubmit={handleSubmit} aria-labelledby="step-details" className="grid gap-[var(--sf-space-md)]">
                    <h2 id="step-details" className="sf-display text-[var(--sf-text-2xl)]">Your details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label htmlFor="booking-name" className="sf-field sm:col-span-2">Full name
                        <input id="booking-name" type="text" required autoComplete="name" value={clientInfo.name} onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })} className="sf-input" />
                      </label>
                      <label htmlFor="booking-email" className="sf-field">Email
                        <input id="booking-email" type="email" required autoComplete="email" value={clientInfo.email} onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })} className="sf-input" />
                      </label>
                      <label htmlFor="booking-phone" className="sf-field">Phone
                        <input id="booking-phone" type="tel" required autoComplete="tel" value={clientInfo.phone} onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })} className="sf-input" />
                      </label>
                      <label htmlFor="booking-notes" className="sf-field sm:col-span-2">Notes for your stylist <span className="sf-field-hint">Optional</span>
                        <textarea id="booking-notes" value={clientInfo.notes} onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })} className="sf-input min-h-[100px]" />
                      </label>
                    </div>

                    <label className="sf-card-quiet flex items-start gap-3 p-4 text-[var(--sf-text-sm)]">
                      <input type="checkbox" required checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sf-ink)]" />
                      <span>I agree to the booking policy: cancel at least {formatNotice(bookingContext?.policy.cancellationNoticeMinutes)} and reschedule at least {formatNotice(bookingContext?.policy.rescheduleNoticeMinutes)} before my appointment.</span>
                    </label>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="sf-track self-start">
                        <button type="button" onClick={() => setStep(3)} className="sf-btn sf-btn-quiet">
                          <ChevronLeft />
                          Back
                        </button>
                      </div>
                      <div className="sf-track sf-track-block sm:w-auto">
                        <button type="submit" disabled={submitting || !requestKey || !locationId || !bookingContext || !policyAccepted} className="sf-btn sf-btn-primary">
                          {submitting ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                              Booking…
                            </>
                          ) : (
                            <>
                              <Check />
                              Confirm booking
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          <aside className="sf-booking-aside" aria-label="Your visit">
            <div className="sf-ticket overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-[var(--sf-space-md)]">
                <h2 className="sf-display text-[var(--sf-text-xl)]">Your visit</h2>
                <span className="sf-swatch-fan" aria-hidden="true">{[1, 2, 3].map((swatch) => <span key={swatch} className="sf-swatch" data-swatch={swatch} />)}</span>
              </div>
              <div className="sf-ticket-perf" />
              {summary}
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--sf-rule)] px-[var(--sf-space-md)] py-4">
                <span className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{service ? `${service.baseDuration} min` : "Total"}</span>
                <span className="sf-menu-price">{service ? formatMenuPrice(service.basePrice) : "—"}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
