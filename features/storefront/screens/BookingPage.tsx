"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, ChevronLeft } from "lucide-react"
import type { Service } from "../lib/data/services"
import { getStylistsForService } from "../lib/data/stylists"
import type { Stylist } from "../lib/data/stylists"
import { createAppointment } from "../lib/data/appointments"
import { getBookingContext } from "../lib/data/booking-context"
import { getAvailableTimeSlots, type BookingSlot } from "../lib/data/availability"
import { clearBookingRequestKey, getOrCreateBookingRequestKey } from "../lib/data/bookingSubmitOutcome"
import type { BookingContextRead, BookingSelectionRead } from "../lib/data/bookingSelectionRead"
import { serviceTags } from "../components/ServiceCard"
import type { CategoryBands } from "../lib/bands"
import { StylistPortrait, stylistTitle } from "../components/StylistCard"
import { PayDepositButton } from "../components/PayDepositButton"
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
  /** Category shades ranked over the whole catalogue, shared with home and /services. */
  categoryBands?: CategoryBands | null
  /** A day (YYYY-MM-DD) and slot start picked on the home booking picker; used once if still open. */
  preferredDate?: string | null
  preferredTime?: string | null
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

export function BookingPage({ initialServiceCatalog, preselectedService = null, preselectedStylist = null, preselectedStylistName = null, preselectedStylistServiceIds = null, preferredDate = null, preferredTime = null }: BookingPageProps) {

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
  const [deposit, setDeposit] = useState<{ amount: number; token: string } | null>(null)
  const [depositDue, setDepositDue] = useState<number | null>(null)
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

  // A stylist chosen before the service (e.g. "Book with …") skips the stylist step once qualified, once.
  const preselectSkip = useRef(Boolean(preselectedStylist))
  useEffect(() => {
    if (!preselectSkip.current || step !== 2 || stylistRead.status !== "available") return
    preselectSkip.current = false
    if (selectedStylist && selectedStylist === preselectedStylist) setStep(3)
  }, [step, selectedStylist, preselectedStylist, stylistRead.status])

  // A day and time carried from the home picker: applied once, when the time step first opens with that stylist.
  const preference = useRef(preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ? { date: preferredDate, time: preferredTime, stage: "date" as "date" | "time" | "done" } : null)
  useEffect(() => {
    const wanted = preference.current
    if (!wanted || wanted.stage !== "date" || step !== 3 || !selectedStylist || selectedStylist !== preselectedStylist) return
    const [year, month, day] = wanted.date.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      wanted.stage = "done"
      return
    }
    wanted.stage = wanted.time ? "time" : "done"
    setSelectedDate(date)
  }, [step, selectedStylist, preselectedStylist])
  useEffect(() => {
    const wanted = preference.current
    if (!wanted || wanted.stage !== "time" || loadingSlots || !selectedDate || localDateKey(selectedDate) !== wanted.date) return
    if (availableSlots.length === 0) return
    wanted.stage = "done"
    if (availableSlots.some((slot) => slot.startTime === wanted.time)) setSelectedTime(wanted.time)
  }, [availableSlots, loadingSlots, selectedDate])

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
        // One qualified stylist is chosen for the client; they still see who it is and confirm.
        setSelectedStylist(current => current && result.items.some(stylist => stylist.id === current) ? current : result.items.length === 1 ? result.items[0].id : null)
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

  // Choosing marks the row; Continue (bottom bar on a phone, summary on desktop) moves on.
  const handleServiceSelect = (serviceId: string) => {
    setError(null)
    if (serviceId === selectedService) return
    setSelectedService(serviceId)
    setStylistRead({ status: "loading" })
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])
  }

  const handleStylistSelect = (stylistId: string) => {
    setError(null)
    if (stylistId === selectedStylist) return
    setSelectedStylist(stylistId)
    setSelectedDate(undefined)
    setSelectedTime(null)
    setAvailableSlots([])
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
      setDepositDue(result.depositAmount ?? null)
      setDeposit(result.depositAmount && result.depositAccessToken ? { amount: result.depositAmount, token: result.depositAccessToken } : null)
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
  const shortDate = selectedDate?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  const servicesByCategory = menuServices.reduce<Array<{ name: string; items: Service[] }>>((groups, item) => {
    const name = item.category?.name || "Services"
    const group = groups.find((entry) => entry.name === name)
    if (group) group.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])

  const detailsReady = Boolean(requestKey && locationId && bookingContext && policyAccepted && !submitting)
  const when = [shortDate, selectedTimeLabel].filter(Boolean).join(" · ")
  const barMeta = [stylist?.user?.name, when].filter(Boolean).join(" · ")

  // Move the view to the top of the flow whenever the step changes, so a phone never lands mid-list.
  const flowTop = useRef<HTMLDivElement>(null)
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    const top = flowTop.current
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: "start" })
  }, [step])

  const stepTitle = step === 1 ? "Choose a service" : step === 2 ? "Choose your stylist" : step === 3 ? "Choose a time" : "Your details"
  const stepNote = step === 1
    ? null
    : step === 2 ? service?.name
    : step === 3 ? [service?.name, stylist?.user?.name ? `with ${stylist.user.name}` : null].filter(Boolean).join(" ")
    : [service?.name, dateLabel && selectedTimeLabel ? `${dateLabel} at ${selectedTimeLabel}` : null].filter(Boolean).join(", ")

  // The next action for the current step: what the bar (phone) and the summary (desktop) offer.
  const nextAction: { label: string; disabled: boolean; onClick?: () => void; submit?: boolean } | null =
    step === 1 ? (service ? { label: "Continue", disabled: false, onClick: () => { setStep(2); setError(null) } } : null)
    : step === 2 ? { label: "Continue", disabled: !stylist, onClick: () => { if (stylist) { setStep(3); setError(null) } } }
    : step === 3 ? { label: "Continue", disabled: !selectedDate || !selectedTime, onClick: handleDateTimeConfirm }
    : { label: submitting ? "Booking…" : "Confirm booking", disabled: !detailsReady, submit: true }

  const actionButton = (className = "") => nextAction ? (
    nextAction.submit
      ? <button type="submit" form="sf-booking-details" disabled={nextAction.disabled} className={`sf-btn sf-btn-primary ${className}`}>{submitting ? <span className="sf-spinner" aria-hidden="true" /> : null}{nextAction.label}</button>
      : <button type="button" onClick={nextAction.onClick} disabled={nextAction.disabled} className={`sf-btn sf-btn-primary ${className}`}>{nextAction.label}</button>
  ) : null

  const visitRows = (
    <dl className="sf-bk-visit">
      <div><dt>Service</dt><dd>{service?.name || "Not chosen yet"}</dd></div>
      <div><dt>Stylist</dt><dd>{stylist?.user?.name || (step > 1 ? "Not chosen yet" : "After the service")}</dd></div>
      <div><dt>Time</dt><dd>{dateLabel && selectedTimeLabel ? <>{dateLabel}<br />{selectedTimeLabel}</> : dateLabel || "Not chosen yet"}</dd></div>
      {location ? <div><dt>Location</dt><dd>{location.name}</dd></div> : null}
    </dl>
  )

  // Success screen
  if (bookingSuccess) {
    return (
      <div className="sf-bk">
        <div className="sf-bk-done sf-bk-panel">
          <span className="sf-bk-done-mark" aria-hidden="true"><Check /></span>
          <h1 className="sf-bk-title">You&apos;re booked</h1>
          <p className="sf-bk-lede">Your booking is confirmed. Keep this page or your account for the details.</p>
          <dl className="sf-bk-visit sf-bk-visit-ruled">
            <div><dt>Service</dt><dd>{service?.name || "—"}</dd></div>
            <div><dt>Stylist</dt><dd>{stylist?.user?.name || "—"}</dd></div>
            <div><dt>When</dt><dd>{dateLabel && selectedTimeLabel ? `${dateLabel}, ${selectedTimeLabel}` : "—"}</dd></div>
            {location ? <div><dt>Where</dt><dd>{location.name}</dd></div> : null}
            <div><dt>Price</dt><dd className="sf-num">{formatMenuPrice(service?.basePrice)}</dd></div>
            <div><dt>Reference</dt><dd className="sf-bk-ref">{(bookingId || "").slice(-8).toUpperCase()}</dd></div>
          </dl>
          {deposit && bookingId ? (
            <div className="sf-bk-deposit">
              <p>A {formatMenuPrice(deposit.amount / 100)} deposit holds your time. Pay it now by card, or at the salon.</p>
              <PayDepositButton appointmentId={bookingId} accessToken={deposit.token} amount={deposit.amount} />
            </div>
          ) : depositDue ? (
            <p className="sf-bk-deposit">A {formatMenuPrice(depositDue / 100)} deposit is due. Pay it at the salon.</p>
          ) : null}
          <div className="sf-bk-done-links">
            {bookingContext?.client ? <Link className="sf-link" href={`/booking/${bookingId}`}>View your appointment</Link> : <p className="text-[var(--sf-ink-2)]">To change this booking, contact the salon.</p>}
            <a href="/book" className="sf-link">Book another</a>
            <Link href="/" className="sf-link">Home</Link>
          </div>
        </div>
      </div>
    )
  }

  const showBar = !bookingOutcomeUnresolved && Boolean(service)

  return (
    <div className={`sf-bk ${showBar ? "sf-bk-has-bar" : ""}`}>
      <div className="sf-bk-layout">
        <div className="min-w-0" ref={flowTop}>
          <BookingStepIndicator currentStep={step} steps={STEPS} onSelect={bookingOutcomeUnresolved ? undefined : handleStepSelect} />

          <header className="sf-bk-head">
            {step > 1 && !bookingOutcomeUnresolved ? (
              <button type="button" className="sf-bk-back" onClick={() => handleStepSelect(step - 1)} aria-label={`Back to ${STEPS[step - 2].title.toLowerCase()}`}>
                <ChevronLeft aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <h1 className="sf-bk-title" aria-live="polite">{stepTitle}</h1>
              {stepNote ? <p className="sf-bk-lede">{stepNote}</p> : null}
            </div>
          </header>

          {bookingContextRead === null ? <p role="status" className="sf-bk-notice">Loading booking details…</p> : null}
          {bookingContextRead?.status === "unavailable" ? <div role="alert" className="sf-alert mb-4">Booking configuration could not be verified. No reservation can be submitted. <button type="button" className="sf-link ml-1" onClick={() => setBookingContextAttempt(attempt => attempt + 1)}>Retry booking details</button></div> : null}
          {bookingContextRead?.status === "available" && bookingContextRead.data.locations.length === 0 ? <p role="status" className="sf-bk-notice">No salon locations are available for online booking. Contact the salon.</p> : null}
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
            <div role="alert" className="sf-bk-panel grid gap-4">
              <h2 className="sf-bk-title !text-[length:var(--sf-text-2xl)]">We couldn&apos;t confirm your booking request</h2>
              <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Retry below; it won&apos;t be booked twice. If it&apos;s still unclear, check your email or contact the salon.</p>
              <div>
                <button type="button" className="sf-btn sf-btn-primary" disabled={submitting || !requestKey} onClick={() => void submitBooking()}>
                  {submitting ? "Checking request…" : "Retry same booking request"}
                </button>
              </div>
            </div>
          ) : (
            <div key={step} className="sf-bk-step">
              {step === 1 && (
                <section aria-label="Services">
                  {stylistFilter ? (
                    <p className="sf-bk-filter">
                      Showing services with {preselectedStylistName || "your stylist"}.{" "}
                      <button type="button" className="sf-link" onClick={clearStylistFilter}>Show all services</button>
                    </p>
                  ) : null}
                  {initialServiceCatalog.status === "unavailable" ? (
                    <div role="alert" className="sf-alert">
                      Service choices could not be verified. No service can be selected until the catalog loads.
                      <button type="button" className="sf-link ml-1" onClick={() => window.location.reload()}>Retry service catalog</button>
                    </div>
                  ) : services.length === 0 ? (
                    <p role="status" className="sf-bk-notice">No services are available for online booking. Contact the salon.</p>
                  ) : (
                    <div className="grid gap-[var(--sf-space-lg)]">
                      {servicesByCategory.map((group) => (
                        <div key={group.name} role="group" aria-labelledby={`cat-${group.name}`}>
                          {servicesByCategory.length > 1 ? <h2 id={`cat-${group.name}`} className="sf-bk-category">{group.name}</h2> : null}
                          <ul className="sf-bk-list">
                            {group.items.map((svc) => {
                              const notes = serviceTags(svc)
                              const chosen = selectedService === svc.id
                              return (
                                <li key={svc.id}>
                                  <button type="button" aria-pressed={chosen} onClick={() => handleServiceSelect(svc.id)} className="sf-bk-option" data-service-option>
                                    <span className="sf-bk-radio" aria-hidden="true"><Check /></span>
                                    <span className="sf-bk-option-main">
                                      <span className="sf-bk-option-name">{svc.name}</span>
                                      {svc.description ? <span className="sf-bk-option-desc">{svc.description}</span> : null}
                                      {notes.length ? <span className="sf-bk-option-note">{notes.join(" · ")}</span> : null}
                                    </span>
                                    <span className="sf-bk-option-figures">
                                      <span className="sf-bk-price">{formatMenuPrice(svc.basePrice)}</span>
                                      <span className="sf-bk-duration">{svc.baseDuration} min</span>
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {step === 2 && (
                <section aria-label="Stylists">
                  {stylistRead.status === "loading" || stylistRead.status === "idle" ? <p role="status" className="sf-bk-empty"><span className="sf-spinner" aria-hidden="true" />Finding stylists for this service…</p> : null}
                  {stylistRead.status === "unavailable" ? <div role="alert" className="sf-alert">Stylist choices could not be verified. No stylist is selected. <button type="button" className="sf-link ml-1" onClick={() => setStylistRetryAttempt(attempt => attempt + 1)}>Retry stylist list</button></div> : null}
                  {stylistRead.status === "available" && stylists.length === 0 ? <p role="status" className="sf-bk-notice">No stylists are available for this service. Contact the salon.</p> : null}
                  {stylistRead.status === "available" && stylists.length > 0 ? (
                    <ul className="sf-bk-list">
                      {stylists.map((styl) => (
                        <li key={styl.id}>
                          <button type="button" aria-pressed={selectedStylist === styl.id} onClick={() => handleStylistSelect(styl.id)} className="sf-bk-option sf-bk-person" data-stylist-option>
                            <StylistPortrait stylist={styl} className="sf-bk-portrait" />
                            <span className="sf-bk-option-main">
                              <span className="sf-bk-option-name">{styl.user?.name || "Stylist"}</span>
                              <span className="sf-bk-option-desc">{stylistTitle(styl.tier, styl.role)}</span>
                              {styl.bio ? <span className="sf-bk-option-note sf-bk-bio">{styl.bio}</span> : null}
                            </span>
                            <span className="sf-bk-radio" aria-hidden="true"><Check /></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )}

              {step === 3 && (
                <section aria-label="Day and time">
                  <TimeSlotPicker
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    selectedTime={selectedTime}
                    onTimeSelect={setSelectedTime}
                    availableSlots={availableSlots}
                    loadingSlots={loadingSlots}
                  />
                  {selectedDate && !loadingSlots && availableSlots.length === 0 && selectedService ? (
                    <div className="sf-bk-waitlist">
                      <p>{waitlist.status === "joined" ? "You're on the waitlist for this day. We'll email you if a time opens." : "Want this day anyway? Join the waitlist and we'll email you if a time opens."}</p>
                      {waitlist.status === "joined" ? null : bookingContext?.client ? (
                        <button type="button" disabled={waitlist.status === "sending"} onClick={async () => {
                          setWaitlist({ status: "sending" })
                          const result = await joinWaitlistForDay({ serviceId: selectedService, stylistId: selectedStylist, localDate: localDateKey(selectedDate) })
                          setWaitlist(result.status === "joined" ? { status: "joined" } : { status: "error", message: result.message })
                        }} className="sf-btn sf-btn-sm self-start">{waitlist.status === "sending" ? "Joining…" : "Join the waitlist"}</button>
                      ) : <Link href="/account/signin" className="sf-link self-start">Sign in to join the waitlist</Link>}
                    </div>
                  ) : null}
                  {waitlist.status === "error" ? <p role="alert" className="sf-alert mt-2">{waitlist.message}</p> : null}
                </section>
              )}

              {step === 4 && (
                <form id="sf-booking-details" onSubmit={handleSubmit} aria-label="Your details" className="grid gap-[var(--sf-space-md)]">
                  {/* The booking context reads any signed-in user (it pre-fills details); the client portal needs a client profile. Say what is true here. */}
                  {bookingContext?.client
                    ? <p className="sf-bk-account">Filled in from your account, {bookingContext.client.name}.</p>
                    : <p className="sf-bk-account">Been here before? <Link className="sf-link" href="/account">Sign in</Link> to fill this in.</p>}
                  <div className="sf-bk-fields">
                    <label htmlFor="booking-name" className="sf-field sf-bk-span">Full name
                      <input id="booking-name" type="text" required autoComplete="name" value={clientInfo.name} onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })} className="sf-input" />
                    </label>
                    <label htmlFor="booking-email" className="sf-field">Email
                      <input id="booking-email" type="email" required autoComplete="email" inputMode="email" value={clientInfo.email} onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })} className="sf-input" />
                    </label>
                    <label htmlFor="booking-phone" className="sf-field">Phone
                      <input id="booking-phone" type="tel" required autoComplete="tel" inputMode="tel" value={clientInfo.phone} onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })} className="sf-input" />
                    </label>
                    <label htmlFor="booking-notes" className="sf-field sf-bk-span">
                      <span>Notes for your stylist <span className="sf-field-hint">· optional</span></span>
                      <textarea id="booking-notes" value={clientInfo.notes} onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })} className="sf-input min-h-[6.5rem]" placeholder="Anything we should know before your visit" />
                    </label>
                  </div>

                  {selectedTime && bookingContext?.policy && new Date(selectedTime).getTime() - Date.now() < Math.min(bookingContext.policy.cancellationNoticeMinutes, bookingContext.policy.rescheduleNoticeMinutes) * 60_000 ? (
                    <p role="status" className="sf-bk-notice">This time is inside the notice window, so it can&apos;t be cancelled or rescheduled online. Contact the salon to change it.</p>
                  ) : null}
                  <label className="sf-bk-policy">
                    <input type="checkbox" required checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)} />
                    <span>I agree to the booking policy: cancel at least {formatNotice(bookingContext?.policy.cancellationNoticeMinutes)} and reschedule at least {formatNotice(bookingContext?.policy.rescheduleNoticeMinutes)} before my appointment.</span>
                  </label>
                </form>
              )}
            </div>
          )}
        </div>

        <aside className="sf-bk-aside" aria-label="Your visit">
          <div className="sf-bk-summary">
            <h2 className="sf-bk-summary-title">Your visit</h2>
            {visitRows}
            <div className="sf-bk-total">
              <span>{service ? `${service.baseDuration} min` : "Total"}</span>
              <span className="sf-num">{service ? formatMenuPrice(service.basePrice) : "—"}</span>
            </div>
            {!bookingOutcomeUnresolved ? actionButton("w-full") : null}
          </div>
        </aside>
      </div>

      {showBar ? (
        <div className="sf-bk-bar" role="region" aria-label="Your visit">
          <div className="sf-bk-bar-inner">
            <div className="min-w-0 flex-1">
              <p className="sf-bk-bar-line"><span className="sf-bk-bar-name">{service!.name}</span><span className="sf-num">{formatMenuPrice(service!.basePrice)}</span></p>
              <p className="sf-bk-bar-meta">{barMeta || `${service!.baseDuration} min`}</p>
            </div>
            {actionButton("shrink-0")}
          </div>
        </div>
      ) : null}
    </div>
  )
}
