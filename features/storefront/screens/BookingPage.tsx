"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, ChevronLeft, Calendar as CalendarIcon, User, Clock, Mail, Phone, MessageSquare } from "lucide-react"
import type { Service } from "../lib/data/services"
import { getStylistsForService } from "../lib/data/stylists"
import type { Stylist } from "../lib/data/stylists"
import { createAppointment } from "../lib/data/appointments"
import { getBookingContext } from "../lib/data/booking-context"
import { getAvailableTimeSlots, type BookingSlot } from "../lib/data/availability"
import { clearBookingRequestKey, getOrCreateBookingRequestKey } from "../lib/data/bookingSubmitOutcome"
import type { BookingContextRead, BookingSelectionRead } from "../lib/data/bookingSelectionRead"
import { ServiceCard } from "../components/ServiceCard"
import { StylistCard } from "../components/StylistCard"
import { TimeSlotPicker } from "../components/TimeSlotPicker"
import { BookingStepIndicator } from "../components/BookingStepIndicator"
import { formatPrice } from "../lib/format-price"

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
  { number: 1, title: "Service", description: "Choose service" },
  { number: 2, title: "Stylist", description: "Pick your stylist" },
  { number: 3, title: "Date & Time", description: "Select slot" },
  { number: 4, title: "Details", description: "Your information" }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitBooking()
  }

  // Success screen
  if (bookingSuccess) {
    return (
      <div className="sf-page-pad">
        <div className="sf-container-narrow">
            <div className="sf-card p-8 text-center md:p-12">
              <div className="w-16 h-16 border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-[var(--sf-accent)]" />
              </div>
              <h1 className="sf-display text-[var(--sf-text-display-s)] mb-4">Booking received.</h1>
              <p className="text-[var(--sf-text-md)] leading-relaxed text-[var(--sf-ink-2)] mb-8">
                Contact email · <span className="font-medium text-[var(--sf-ink)]">{clientInfo.email}</span>
              </p>

              <div className="bg-[var(--sf-paper-2)] border border-[var(--sf-rule)] p-6 mb-8 text-left">
                <h2 className="font-medium text-[var(--sf-text-md)] mb-4">Appointment details</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-[var(--sf-accent)]">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{service?.name}</div>
                      <div className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{service?.baseDuration} minutes · {formatPrice(service?.basePrice)}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-[var(--sf-accent)]">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{stylist?.user?.name}</div>
                      <div className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)] capitalize">{stylist?.tier} stylist</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-[var(--sf-accent)]">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {selectedDate?.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </div>
                      <div className="text-[var(--sf-text-sm)] text-[var(--sf-ink-3)]">{selectedTimeLabel}</div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mb-4 text-sm">Booking reference · <strong>{bookingId}</strong></p>
              {bookingContext?.client ? <Link className="sf-link block mb-5" href={`/booking/${bookingId}`}>View your saved appointment</Link> : <p className="mb-5 text-sm">To change this booking, contact the salon.</p>}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/" className="sf-btn sf-btn-primary">
                  Back home
                </Link>
                <a href="/book" className="sf-btn sf-btn-secondary">
                  Book another
                </a>
              </div>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-page-pad">
      <div className="sf-container max-w-3xl">
          <div className="mb-[var(--sf-space-lg)]">
            <h1 className="sf-display text-[var(--sf-text-display-s)] mb-3">Reserve your visit</h1>
          </div>

          <label className="mb-2 grid gap-2 text-sm">Salon location
            <select className="sf-input" value={locationId} disabled={!bookingContext || bookingContext.locations.length === 0} onChange={event => { setLocationId(event.target.value); setSelectedTime(null); setAvailableSlots([]) }} required>
              <option value="">Choose a location</option>{bookingContext?.locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.timezone || "Timezone unavailable"}</option>)}
            </select>
          </label>
          {bookingContextRead === null ? <p role="status" className="mb-6 text-sm">Loading booking locations and policy…</p> : null}
          {bookingContextRead?.status === "unavailable" ? <div role="alert" className="mb-6 border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-4 text-sm">Booking configuration could not be verified. No reservation can be submitted. <button type="button" className="sf-link ml-2" onClick={() => setBookingContextAttempt(attempt => attempt + 1)}>Retry booking details</button></div> : null}
          {bookingContextRead?.status === "available" && bookingContextRead.data.locations.length === 0 ? <p role="status" className="mb-6 text-sm">No active salon locations are currently available for online booking. Please contact the salon.</p> : null}
          {requestKeyUnavailable ? <p role="alert" className="mb-6 border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-4 text-sm">Online booking needs site storage. Enable it in your browser and reload, or contact the salon.</p> : null}
          <Link className="sf-link block mb-4" href="/account">Client account</Link>
          {/* Step Indicator */}
          <BookingStepIndicator currentStep={step} steps={STEPS} />

          {/* Error Message */}
          {error && (
            <div className="mb-6 border border-[color-mix(in_oklch,var(--sf-accent)_30%,var(--sf-rule))] bg-[var(--sf-accent-soft)] p-4 text-[var(--sf-text-sm)] text-[var(--sf-ink)]">
              {error}
            </div>
          )}

          <div className="sf-card p-[var(--sf-space-md)] md:p-[var(--sf-space-lg)]">
            {bookingOutcomeUnresolved ? (
              <div role="alert" className="space-y-4">
                <h2 className="sf-display text-[var(--sf-text-2xl)]">We couldn&apos;t confirm your booking request</h2>
                <p className="text-sm text-[var(--sf-ink-2)]">We couldn&apos;t confirm your booking. Retry below; it won&apos;t be booked twice. If it&apos;s still unclear, check your email or contact the salon.</p>
                <button type="button" className="sf-btn sf-btn-primary" disabled={submitting || !requestKey} onClick={() => void submitBooking()}>
                  {submitting ? "Checking request…" : "Retry same booking request"}
                </button>
              </div>
            ) : (
              <>
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">Select a service</h2>
                  <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Start with the treatment you would like to reserve.</p>
                </div>
                {initialServiceCatalog.status === "unavailable" ? (
                  <div role="alert" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-6 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                    Service choices could not be verified. No service can be selected until the catalog loads.
                    <button type="button" className="sf-link ml-2" onClick={() => window.location.reload()}>Retry service catalog</button>
                  </div>
                ) : services.length === 0 ? (
                  <div role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-6 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                    No active services are currently available for online booking. Please contact the salon.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {services.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => handleServiceSelect(svc.id)}
                        className="text-left"
                      >
                        <ServiceCard service={svc} variant="compact" linked={false} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">Choose your artist</h2>
                    <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Select an artist for {service?.name}</p>
                  </div>
                  <button type="button" onClick={() => setStep(1)} className="sf-link text-[var(--sf-text-sm)]">
                    Change service
                  </button>
                </div>
                {stylistRead.status === "loading" || stylistRead.status === "idle" ? <p role="status">Loading artists…</p> : null}
                {stylistRead.status === "unavailable" ? <div role="alert" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-5 text-sm">Artist choices could not be verified. No artist is selected. <button type="button" className="sf-link ml-2" onClick={() => setStylistRetryAttempt(attempt => attempt + 1)}>Retry artist list</button></div> : null}
                {stylistRead.status === "available" && stylists.length === 0 ? <p role="status" className="border border-[var(--sf-rule)] bg-[var(--sf-paper-2)] p-5 text-sm">No active qualified artists are currently available for this service. Please contact the salon.</p> : null}
                {stylistRead.status === "available" && stylists.length > 0 ? <div className="grid md:grid-cols-2 gap-4">
                  {stylists.map((styl) => (
                    <button
                      key={styl.id}
                      type="button"
                      onClick={() => handleStylistSelect(styl.id)}
                      className="text-left"
                    >
                      <StylistCard stylist={styl} variant="compact" linked={false} />
                    </button>
                  ))}
                </div> : null}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">Select date and time</h2>
                    <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">
                      Pick your preferred time with {stylist?.user?.name}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setSelectedStylist(null); setStep(2) }} className="sf-link text-[var(--sf-text-sm)]">
                    Change artist
                  </button>
                </div>
                <TimeSlotPicker
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  selectedTime={selectedTime}
                  onTimeSelect={setSelectedTime}
                  availableSlots={availableSlots}
                  loadingSlots={loadingSlots}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleDateTimeConfirm}
                    disabled={!selectedDate || !selectedTime}
                    className="sf-btn sf-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="sf-display text-[var(--sf-text-2xl)] mb-2">Your information</h2>
                    <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Contact details for confirmation.</p>
                  </div>
                  <button type="button" onClick={() => setStep(3)} className="sf-link text-[var(--sf-text-sm)]">
                    Change time
                  </button>
                </div>

                <div className="bg-[var(--sf-paper-2)] border border-[var(--sf-rule)] p-4">
                  <h3 className="font-medium mb-3">Booking summary</h3>
                  <div className="space-y-2 text-[var(--sf-text-sm)]">
                    <div className="flex justify-between gap-4">
                      <span className="text-[var(--sf-ink-3)]">Service</span>
                      <span className="font-medium">{service?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--sf-ink-3)]">Artist</span>
                      <span className="font-medium">{stylist?.user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--sf-ink-3)]">Date</span>
                      <span className="font-medium">{selectedDate?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--sf-ink-3)]">Time</span>
                      <span className="font-medium">{selectedTimeLabel}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[var(--sf-rule)]">
                      <span className="text-[var(--sf-ink-3)]">Price</span>
                      <span className="font-bold text-lg">{formatPrice(service?.basePrice)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="booking-name" className="block text-sm font-medium mb-2">
                      <span className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-[var(--sf-ink-3)]" />
                        Full Name *
                      </span>
                    </label>
                    <input
                      id="booking-name"
                      type="text"
                      required
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                      className="sf-input"
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-email" className="block text-sm font-medium mb-2">
                      <span className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-[var(--sf-ink-3)]" />
                        Email Address *
                      </span>
                    </label>
                    <input
                      id="booking-email"
                      type="email"
                      required
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                      className="sf-input"
                      placeholder="jane@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-phone" className="block text-sm font-medium mb-2">
                      <span className="flex items-center gap-2 mb-1">
                        <Phone className="h-4 w-4 text-[var(--sf-ink-3)]" />
                        Phone Number *
                      </span>
                    </label>
                    <input
                      id="booking-phone"
                      type="tel"
                      required
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                      className="sf-input"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-notes" className="block text-sm font-medium mb-2">
                      <span className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-4 w-4 text-[var(--sf-ink-3)]" />
                        Special Requests (Optional)
                      </span>
                    </label>
                    <textarea
                      id="booking-notes"
                      value={clientInfo.notes}
                      onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                      className="sf-input min-h-[100px]"
                      placeholder="Any special requests or notes for your stylist..."
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)} />
                  <span>I agree to the booking policy: cancel at least {formatNotice(bookingContext?.policy.cancellationNoticeMinutes)} and reschedule at least {formatNotice(bookingContext?.policy.rescheduleNoticeMinutes)} before my appointment.</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="sf-btn sf-btn-secondary"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !requestKey || !locationId || !bookingContext || !policyAccepted}
                    className="sf-btn sf-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="h-5 w-5 animate-spin border-b-2 border-current"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="h-5 w-5" />
                        Confirm Booking
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
              </>
            )}
          </div>
      </div>
    </div>
  )
}
