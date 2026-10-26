"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, ChevronLeft, ShieldCheck } from "lucide-react"
import type { Service } from "../lib/data/services"
import { getStylistsForService } from "../lib/data/stylists"
import type { Stylist } from "../lib/data/stylists"
import { createAppointment } from "../lib/data/appointments"
import { getBookingContext } from "../lib/data/booking-context"
import { getAvailableTimeSlots, type BookingSlot } from "../lib/data/availability"
import { clearBookingRequestKey, getOrCreateBookingRequestKey } from "../lib/data/bookingSubmitOutcome"
import type { BookingContextRead, BookingSelectionRead } from "../lib/data/bookingSelectionRead"
import { bandFor, serviceTags } from "../components/ServiceCard"
import { StylistPortrait, stylistTitle } from "../components/StylistCard"
import { TimeSlotPicker } from "../components/TimeSlotPicker"
import { joinWaitlistForDay } from "../lib/data/waitlist"
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
  preselectedStylistName?: string | null
  /** Services the preselected stylist performs; null when unknown. */
  preselectedStylistServiceIds?: string[] | null
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

export function BookingPage({ initialServiceCatalog, preselectedService = null, preselectedStylist = null, preselectedStylistName = null, preselectedStylistServiceIds = null }: BookingPageProps) {

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
  const [waitlist, setWaitlist] = useState<{ status: "idle" | "sending" | "joined" } | { status: "error"; message: string }>({ status: "idle" })
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
    setWaitlist({ status: "idle" })
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

  // "Book with …" narrows the menu to that stylist's services until the client clears it.
  const stylistFilter = selectedStylist && selectedStylist === preselectedStylist && preselectedStylistServiceIds?.length ? preselectedStylistServiceIds : null
  const menuServices = stylistFilter ? services.filter((item) => stylistFilter.includes(item.id)) : services
  const clearStylistFilter = () => { setSelectedStylist(null); setError(null) }

  const location = bookingContext?.locations.find((item) => item.id === locationId)
  const dateLabel = selectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const servicesByCategory = menuServices.reduce<Array<{ name: string; items: Service[] }>>((groups, item) => {
    const name = item.category?.name || "Services"
    const group = groups.find((entry) => entry.name === name)
    if (group) group.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])

  // Category order fixes each service's band colour, the same as on the services page.
  const bandByService = new Map<string, string>()
  services.reduce<string[]>((names, item) => {
    const name = item.category?.name || "Services"
    if (!names.includes(name)) names.push(name)
    bandByService.set(item.id, bandFor(names.indexOf(name)))
    return names
  }, [])
  const serviceBand = service ? bandByService.get(service.id) || "1" : "1"
  const trayMeta = [stylist?.user?.name, selectedDate?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), selectedTimeLabel].filter(Boolean).join(", ")
  const detailsReady = Boolean(requestKey && locationId && bookingContext && policyAccepted && !submitting)

  const summary = (
    <dl className="px-[var(--sf-space-sm)] py-1">
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
          <div className="sf-carton" data-band={serviceBand} data-selected="true">
            <div className="sf-carton-band"><span className="inline-flex items-center gap-2"><span className="sf-tick"><Check aria-hidden="true" /></span>Booked</span></div>
            <div className="px-[var(--sf-space-sm)] pb-3 pt-[var(--sf-space-sm)] md:px-[var(--sf-space-md)]">
              <h1 className="sf-display text-[length:var(--sf-text-3xl)]">Booking received</h1>
              <p className="mt-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Booked under <span className="font-semibold text-[var(--sf-ink)]">{clientInfo.email}</span></p>
            </div>
            <div className="border-t border-[var(--sf-ink)]">{summary}</div>
            <dl className="border-t border-[var(--sf-rule)] px-[var(--sf-space-sm)] py-1">
              <div className="sf-summary-row"><dt>Price</dt><dd className="sf-num">{formatMenuPrice(service?.basePrice)}</dd></div>
              <div className="sf-summary-row"><dt>Reference</dt><dd className="font-mono !text-[length:var(--sf-text-xs)]">{bookingId}</dd></div>
            </dl>
            <div className="grid gap-4 border-t border-[var(--sf-rule)] p-[var(--sf-space-sm)]">
              {bookingContext?.client ? <Link className="sf-link self-start text-[length:var(--sf-text-sm)]" href={`/booking/${bookingId}`}>View your saved appointment</Link> : <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">To change this booking, contact the salon.</p>}
              <div className="sf-track">
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
    <div className={`sf-page-pad !pt-[var(--sf-space-md)] ${service && !bookingOutcomeUnresolved ? "sf-has-tray" : ""}`}>
      <div className="sf-container">
        <div className="sf-page-head !mb-[var(--sf-space-md)]">
          <h1 className="sf-display sf-page-title">Book</h1>
          {/* The booking context reads any signed-in user (it pre-fills details); the client portal needs a client profile. Say what is true here. */}
          {bookingContext?.client
            ? <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Details filled in for <span className="font-semibold text-[var(--sf-ink)]">{bookingContext.client.name}</span></p>
            : <Link className="sf-link text-[length:var(--sf-text-sm)]" href="/account">Client sign in</Link>}
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
                <h2 className="sf-display text-[length:var(--sf-text-2xl)]">We couldn&apos;t confirm your booking request</h2>
                <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Retry below; it won&apos;t be booked twice. If it&apos;s still unclear, check your email or contact the salon.</p>
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
                    <h2 id="step-service" className="sf-display mb-4 text-[length:var(--sf-text-2xl)]">Choose a service</h2>
                    {stylistFilter ? (
                      <div className="mb-5 flex flex-wrap items-center gap-3">
                        <span className="sf-chip sf-chip-accent">With {preselectedStylistName || "your stylist"}</span>
                        <button type="button" className="sf-btn sf-btn-sm sf-btn-quiet" onClick={clearStylistFilter}>Any stylist</button>
                      </div>
                    ) : null}
                    {initialServiceCatalog.status === "unavailable" ? (
                      <div role="alert" className="sf-alert">
                        Service choices could not be verified. No service can be selected until the catalog loads.
                        <button type="button" className="sf-link ml-1" onClick={() => window.location.reload()}>Retry service catalog</button>
                      </div>
                    ) : services.length === 0 ? (
                      <p role="status" className="sf-note">No services are available for online booking. Contact the salon.</p>
                    ) : (
                      <div className="grid gap-[var(--sf-space-md)]">
                        {servicesByCategory.map((group) => (
                          <div key={group.name}>
                            {servicesByCategory.length > 1 ? <h3 className="sf-display mb-2 border-b border-[var(--sf-ink)] pb-1.5 text-[length:var(--sf-text-lg)]">{group.name}</h3> : null}
                            <div className="sf-shelf-grid">
                              {group.items.map((svc) => {
                                const tags = serviceTags(svc)
                                const chosen = selectedService === svc.id
                                return (
                                  <button key={svc.id} type="button" aria-pressed={chosen} onClick={() => handleServiceSelect(svc.id)} className="sf-carton" data-band={bandByService.get(svc.id) || "1"}>
                                    <span className="sf-carton-band">
                                      <span>{group.name}</span>
                                      {chosen ? <span className="sf-tick"><Check aria-hidden="true" /></span> : <span className="sf-shade" aria-hidden="true" />}
                                    </span>
                                    <span className="sf-carton-body">
                                      <span className="sf-carton-name">{svc.name}</span>
                                      {svc.description ? <span className="sf-carton-desc line-clamp-2">{svc.description}</span> : null}
                                      {tags.length ? <span className="sf-carton-tags">{tags.map((tag) => <span key={tag} className="sf-chip sf-chip-accent"><ShieldCheck aria-hidden="true" />{tag}</span>)}</span> : null}
                                      <span className="sf-carton-figures">
                                        <span className="sf-num sf-carton-duration">{svc.baseDuration}<small>min</small></span>
                                        <span className="sf-num sf-carton-price">{formatMenuPrice(svc.basePrice)}</span>
                                      </span>
                                    </span>
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
                    <h2 id="step-stylist" className="sf-display mb-1 text-[length:var(--sf-text-2xl)]">Choose a stylist</h2>
                    <p className="mb-5 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">For {service?.name}</p>
                    {stylistRead.status === "loading" || stylistRead.status === "idle" ? <p role="status" className="sf-note">Loading stylists…</p> : null}
                    {stylistRead.status === "unavailable" ? <div role="alert" className="sf-alert">Stylist choices could not be verified. No stylist is selected. <button type="button" className="sf-link ml-1" onClick={() => setStylistRetryAttempt(attempt => attempt + 1)}>Retry stylist list</button></div> : null}
                    {stylistRead.status === "available" && stylists.length === 0 ? <p role="status" className="sf-note">No stylists are available for this service. Contact the salon.</p> : null}
                    {stylistRead.status === "available" && stylists.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {stylists.map((styl) => (
                          <button key={styl.id} type="button" aria-pressed={selectedStylist === styl.id} onClick={() => handleStylistSelect(styl.id)} className="sf-pick">
                            <StylistPortrait stylist={styl} className="h-20 w-16 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="sf-carton-name block truncate">{styl.user?.name || "Stylist"}</span>
                              <span className="mt-1 block text-[length:var(--sf-text-xs)] text-[var(--sf-ink-2)]">{stylistTitle(styl.tier, styl.role)}</span>
                            </span>
                            {selectedStylist === styl.id ? <span className="sf-tick"><Check aria-hidden="true" /></span> : <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )}

                {step === 3 && (
                  <section aria-labelledby="step-time">
                    <h2 id="step-time" className="sf-display mb-1 text-[length:var(--sf-text-2xl)]">Pick a time</h2>
                    <p className="mb-5 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">{service?.name} with {stylist?.user?.name}</p>
                    <TimeSlotPicker
                      selectedDate={selectedDate}
                      onDateSelect={handleDateSelect}
                      selectedTime={selectedTime}
                      onTimeSelect={setSelectedTime}
                      availableSlots={availableSlots}
                      loadingSlots={loadingSlots}
                    />
                    {selectedDate && !loadingSlots && availableSlots.length === 0 && selectedService ? (
                      <div className="sf-tray-surface mt-[var(--sf-space-md)] flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[length:var(--sf-text-sm)]">{waitlist.status === "joined" ? "You're on the waitlist for this day." : "No open times this day."}</p>
                        {waitlist.status === "joined" ? null : bookingContext?.client ? (
                          <div className="sf-track self-start">
                            <button type="button" disabled={waitlist.status === "sending"} onClick={async () => {
                              setWaitlist({ status: "sending" })
                              const result = await joinWaitlistForDay({ serviceId: selectedService, stylistId: selectedStylist, localDate: localDateKey(selectedDate) })
                              setWaitlist(result.status === "joined" ? { status: "joined" } : { status: "error", message: result.message })
                            }} className="sf-btn">{waitlist.status === "sending" ? "Joining…" : "Join the waitlist"}</button>
                          </div>
                        ) : <div className="sf-track self-start"><Link href="/account/signin" className="sf-btn">Sign in to join the waitlist</Link></div>}
                      </div>
                    ) : null}
                    {waitlist.status === "error" ? <p role="alert" className="sf-alert mt-2">{waitlist.message}</p> : null}
                    {/* On a phone the tray carries Continue; this one serves wider screens. */}
                    <div className="mt-[var(--sf-space-md)] hidden justify-end lg:flex">
                      <button type="button" onClick={handleDateTimeConfirm} disabled={!selectedDate || !selectedTime} className="sf-btn sf-btn-primary">
                        Continue
                        <ChevronRight />
                      </button>
                    </div>
                  </section>
                )}

                {step === 4 && (
                  <form id="sf-booking-details" onSubmit={handleSubmit} aria-labelledby="step-details" className="grid gap-[var(--sf-space-md)]">
                    <h2 id="step-details" className="sf-display text-[length:var(--sf-text-2xl)]">Your details</h2>
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

                    {selectedTime && bookingContext?.policy && new Date(selectedTime).getTime() - Date.now() < Math.min(bookingContext.policy.cancellationNoticeMinutes, bookingContext.policy.rescheduleNoticeMinutes) * 60_000 ? (
                      <p role="status" className="sf-note !text-[length:var(--sf-text-sm)]">This time is inside the notice window, so it can't be cancelled or rescheduled online. Contact the salon to change it.</p>
                    ) : null}
                    <label className="sf-tray-surface flex cursor-pointer items-start gap-3 p-4 text-[length:var(--sf-text-sm)]">
                      <input type="checkbox" required checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--sf-ink)]" />
                      <span>I agree to the booking policy: cancel at least {formatNotice(bookingContext?.policy.cancellationNoticeMinutes)} and reschedule at least {formatNotice(bookingContext?.policy.rescheduleNoticeMinutes)} before my appointment.</span>
                    </label>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" onClick={() => setStep(3)} className="sf-btn sf-btn-quiet self-start">
                        <ChevronLeft />
                        Back
                      </button>
                      {/* On a phone the tray carries the confirm button for this form. */}
                      <div className="sf-track sf-track-block hidden sm:w-auto lg:flex">
                        <button type="submit" disabled={!detailsReady} className="sf-btn sf-btn-primary">
                          {submitting ? (
                            <>
                              <span className="sf-spinner" aria-hidden="true" />
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
            <div className="sf-tray-surface" data-band={serviceBand}>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--sf-ink)] px-[var(--sf-space-sm)] py-3">
                <h2 className="sf-display text-[length:var(--sf-text-xl)]">Your visit</h2>
                <span className="sf-shade !h-5 !w-5" aria-hidden="true" />
              </div>
              {summary}
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--sf-ink)] px-[var(--sf-space-sm)] py-3">
                <span className="sf-num text-[length:var(--sf-text-2xl)]">{service ? <>{service.baseDuration}<small>min</small></> : "—"}</span>
                <span className="sf-num text-[length:var(--sf-text-xl)]">{service ? formatMenuPrice(service.basePrice) : "—"}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {service && !bookingOutcomeUnresolved ? (
        <div className="sf-tray" role="region" aria-label="Your visit" data-band={serviceBand}>
          <div className="sf-tray-inner">
            <div className="sf-tray-carton">
              <div className="min-w-0">
                <p className="sf-tray-name">{service.name}</p>
                <p className="sf-tray-figures"><span className="sf-num">{service.baseDuration}<small>min</small></span><span className="sf-num">{formatMenuPrice(service.basePrice)}</span></p>
                {trayMeta ? <p className="sf-tray-meta">{trayMeta}</p> : null}
              </div>
            </div>
            {step === 3 ? (
              <button type="button" onClick={handleDateTimeConfirm} disabled={!selectedDate || !selectedTime} className="sf-btn sf-btn-primary shrink-0">Continue</button>
            ) : step === 4 ? (
              <button type="submit" form="sf-booking-details" disabled={!detailsReady} className="sf-btn sf-btn-primary shrink-0">{submitting ? <><span className="sf-spinner" aria-hidden="true" />Booking…</> : "Confirm"}</button>
            ) : step === 1 ? (
              <button type="button" onClick={() => handleServiceSelect(service.id)} className="sf-btn sf-btn-primary shrink-0">Continue</button>
            ) : (
              <button type="button" onClick={() => handleStepSelect(1)} className="sf-btn sf-btn-quiet shrink-0">Change</button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
