"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Check, ChevronRight, ChevronLeft, Calendar as CalendarIcon, User, Clock, Mail, Phone, MessageSquare } from "lucide-react"
import { getAllServices, Service } from "../lib/data/services"
import { getAllStylists, Stylist, getStylistsForService } from "../lib/data/stylists"
import { createAppointment } from "../lib/data/appointments"
import { getAvailableTimeSlots } from "../lib/data/availability"
import { createGuestClient } from "../lib/data/clients"
import { ServiceCard } from "../components/ServiceCard"
import { StylistCard } from "../components/StylistCard"
import { TimeSlotPicker } from "../components/TimeSlotPicker"
import { BookingStepIndicator } from "../components/BookingStepIndicator"

interface ClientInfo {
  name: string
  email: string
  phone: string
  notes: string
}

const STEPS = [
  { number: 1, title: "Service", description: "Choose service" },
  { number: 2, title: "Stylist", description: "Pick your stylist" },
  { number: 3, title: "Date & Time", description: "Select slot" },
  { number: 4, title: "Details", description: "Your information" }
]

export function BookingPage() {
  const searchParams = useSearchParams()
  const preselectedService = searchParams?.get("service") ?? null
  const preselectedStylist = searchParams?.get("stylist") ?? null

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
  const [services, setServices] = useState<Service[]>([])
  const [stylists, setStylists] = useState<Stylist[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Fetch services on mount
  useEffect(() => {
    async function fetchServices() {
      try {
        const data = await getAllServices()
        setServices(data)
      } catch (err) {
        setError("Failed to load services")
      } finally {
        setLoading(false)
      }
    }
    fetchServices()
  }, [])

  // Auto-advance to step 2 if service is preselected
  useEffect(() => {
    if (preselectedService && services.length > 0) {
      setStep(2)
    }
  }, [preselectedService, services])

  // Auto-advance to step 2 if stylist is preselected
  useEffect(() => {
    if (preselectedStylist && !preselectedService) {
      setStep(1)
    }
  }, [preselectedStylist, preselectedService])

  // Fetch stylists when service is selected
  useEffect(() => {
    async function fetchStylists() {
      if (!selectedService) {
        setStylists([])
        return
      }

      try {
        const data = await getStylistsForService(selectedService)
        // If no specialists found, get all stylists
        if (data.length === 0) {
          const allStylists = await getAllStylists()
          setStylists(allStylists)
        } else {
          setStylists(data)
        }
      } catch (err) {
        // Fallback to all stylists
        const allStylists = await getAllStylists()
        setStylists(allStylists)
      }
    }
    fetchStylists()
  }, [selectedService])

  // Fetch available time slots when stylist and date are selected
  useEffect(() => {
    async function fetchSlots() {
      if (!selectedStylist || !selectedDate || !selectedService) {
        setAvailableSlots([])
        return
      }

      setLoadingSlots(true)
      try {
        const service = services.find((s) => s.id === selectedService)
        const duration = service?.baseDuration || 60
        const dateStr = selectedDate.toISOString().split("T")[0]
        const slots = await getAvailableTimeSlots(selectedStylist, dateStr, duration)
        setAvailableSlots(slots)
      } catch (err) {
        console.error("Failed to fetch time slots:", err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [selectedStylist, selectedDate, selectedService, services])

  const service = services.find((s) => s.id === selectedService)
  const stylist = stylists.find((s) => s.id === selectedStylist)

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId)
    setStep(2)
    setError(null)
  }

  const handleStylistSelect = (stylistId: string) => {
    setSelectedStylist(stylistId)
    setStep(3)
    setError(null)
  }

  const handleDateTimeConfirm = () => {
    if (selectedDate && selectedTime) {
      setStep(4)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Create or get existing client
      const client = await createGuestClient({
        name: clientInfo.name,
        email: clientInfo.email,
        phone: clientInfo.phone,
      })

      if (!client) {
        setError("Failed to create client account. Please try again.")
        setSubmitting(false)
        return
      }

      // Convert time to ISO format
      const [time, period] = selectedTime!.split(" ")
      const [hours, minutes] = time.split(":").map(Number)
      let hour24 = hours
      if (period === "PM" && hours !== 12) hour24 += 12
      if (period === "AM" && hours === 12) hour24 = 0

      const appointmentDate = new Date(selectedDate!)
      appointmentDate.setHours(hour24, minutes, 0, 0)

      // Create the appointment
      const result = await createAppointment({
        appointmentDate: appointmentDate.toISOString(),
        clientId: client.id,
        stylistId: selectedStylist!,
        serviceIds: [selectedService!],
        clientNotes: clientInfo.notes || undefined,
      })

      if (result) {
        setBookingSuccess(true)
      } else {
        setError("Failed to create booking. Please try again.")
      }
    } catch (err) {
      console.error("Booking error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Success screen
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border rounded-lg shadow-xl p-8 md:p-12 text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Booking Confirmed!</h1>
              <p className="text-xl text-muted-foreground mb-8">
                Your appointment has been successfully scheduled. A confirmation email has been sent to <span className="font-semibold text-foreground">{clientInfo.email}</span>.
              </p>

              {/* Booking Details */}
              <div className="bg-muted/50 border rounded-lg p-6 mb-8 text-left">
                <h2 className="font-semibold text-lg mb-4">Appointment Details</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-primary">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{service?.name}</div>
                      <div className="text-sm text-muted-foreground">{service?.baseDuration} minutes • ${service?.basePrice}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{stylist?.user?.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{stylist?.tier} Stylist</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-5 h-5 mt-0.5 text-primary">
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
                      <div className="text-sm text-muted-foreground">{selectedTime}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
                >
                  Back to Home
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted transition-all"
                >
                  Book Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Book Your Appointment</h1>
            <p className="text-muted-foreground">Choose your service, stylist, and preferred time</p>
          </div>

          {/* Step Indicator */}
          <BookingStepIndicator currentStep={step} steps={STEPS} />

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Content Card */}
          <div className="bg-card border rounded-lg shadow-lg p-6 md:p-8">
            {/* Step 1: Select Service */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Select a Service</h2>
                  <p className="text-muted-foreground">Choose the service you would like to book</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {services.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => handleServiceSelect(svc.id)}
                      className="text-left"
                    >
                      <ServiceCard service={svc} variant="compact" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Stylist */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Choose Your Stylist</h2>
                    <p className="text-muted-foreground">Select a stylist for {service?.name}</p>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-sm text-primary hover:underline"
                  >
                    Change Service
                  </button>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {stylists.map((styl) => (
                    <button
                      key={styl.id}
                      onClick={() => handleStylistSelect(styl.id)}
                      className="text-left"
                    >
                      <StylistCard stylist={styl} variant="compact" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Select Date & Time */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Select Date & Time</h2>
                    <p className="text-muted-foreground">
                      Pick your preferred appointment time with {stylist?.user?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="text-sm text-primary hover:underline"
                  >
                    Change Stylist
                  </button>
                </div>
                <TimeSlotPicker
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  selectedTime={selectedTime}
                  onTimeSelect={setSelectedTime}
                  availableSlots={availableSlots}
                  loadingSlots={loadingSlots}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleDateTimeConfirm}
                    disabled={!selectedDate || !selectedTime}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Client Information */}
            {step === 4 && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Your Information</h2>
                    <p className="text-muted-foreground">Please provide your contact details</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-sm text-primary hover:underline"
                  >
                    Change Time
                  </button>
                </div>

                {/* Booking Summary */}
                <div className="bg-muted/50 border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium">{service?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stylist</span>
                      <span className="font-medium">{stylist?.user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{selectedDate?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-medium">{selectedTime}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold text-lg">${service?.basePrice}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Full Name *
                      </div>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Email Address *
                      </div>
                    </label>
                    <input
                      type="email"
                      required
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        Phone Number *
                      </div>
                    </label>
                    <input
                      type="tel"
                      required
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        Special Requests (Optional)
                      </div>
                    </label>
                    <textarea
                      value={clientInfo.notes}
                      onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                      placeholder="Any special requests or notes for your stylist..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium hover:bg-muted transition-all"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
