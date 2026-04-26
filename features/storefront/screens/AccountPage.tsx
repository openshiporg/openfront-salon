"use client"

import { Metadata } from "next"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Calendar, Clock, User, Mail, Phone, MapPin, ChevronRight, XCircle, CheckCircle } from "lucide-react"
import { getClientAppointmentsByEmail, Appointment } from "../lib/data/appointments"

export const generateAccountMetadata: Metadata = {
  title: "My Account - Openfront Salon",
  description: "View and manage your salon appointments",
}

interface AppointmentCardProps {
  appointment: Appointment
  isPast: boolean
}

function AppointmentCard({ appointment, isPast }: AppointmentCardProps) {
  const appointmentDate = new Date(appointment.appointmentDate)
  const service = appointment.service
  const stylist = appointment.stylist
  const isUpcoming = !isPast && appointment.status !== "CANCELLED"
  const isCancelled = appointment.status === "CANCELLED"

  return (
    <div className={`border rounded-lg p-6 transition-all ${
      isCancelled
        ? "bg-muted/30 opacity-60"
        : isUpcoming
        ? "bg-card shadow-md hover:shadow-lg"
        : "bg-card"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold">{service?.name}</h3>
            {isCancelled && (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                Cancelled
              </span>
            )}
            {isUpcoming && !isCancelled && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                Upcoming
              </span>
            )}
            {isPast && !isCancelled && appointment.status === "COMPLETED" && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                Completed
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Booking #{appointment.id.slice(0, 8)}
          </div>
        </div>
        {isUpcoming && !isCancelled && (
          <Link
            href={`/booking/${appointment.id}`}
            className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
          >
            View Details
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">
              {appointmentDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {appointmentDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true
              })}
            </div>
          </div>
        </div>

        {/* Stylist */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{stylist?.user?.name}</div>
            <div className="text-sm text-muted-foreground capitalize">
              {stylist?.tier} Stylist
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{service?.baseDuration} minutes</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold">$</span>
          </div>
          <div>
            <div className="font-medium">${service?.basePrice}</div>
            <div className="text-sm text-muted-foreground">Price</div>
          </div>
        </div>
      </div>

      {appointment.clientNotes && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm font-medium mb-1">Notes</div>
          <div className="text-sm text-muted-foreground">{appointment.clientNotes}</div>
        </div>
      )}
    </div>
  )
}

export function AccountPage() {
  const [email, setEmail] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if user has stored email in localStorage
    const storedEmail = localStorage.getItem("clientEmail")
    if (storedEmail) {
      setEmail(storedEmail)
      fetchAppointments(storedEmail)
    }
  }, [])

  const fetchAppointments = async (userEmail: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getClientAppointmentsByEmail(userEmail)
      setAppointments(data)
      setIsLoggedIn(true)
      localStorage.setItem("clientEmail", userEmail)
    } catch (err) {
      setError("Failed to load appointments. Please try again.")
      setIsLoggedIn(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      fetchAppointments(email)
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setEmail("")
    setAppointments([])
    localStorage.removeItem("clientEmail")
  }

  const now = new Date()
  const upcomingAppointments = appointments.filter(
    apt => new Date(apt.appointmentDate) >= now && apt.status !== "CANCELLED"
  )
  const pastAppointments = appointments.filter(
    apt => new Date(apt.appointmentDate) < now || apt.status === "CANCELLED"
  )

  // Login view
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-card border rounded-lg shadow-lg p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-2">My Account</h1>
                <p className="text-muted-foreground">
                  Access your appointment history and upcoming bookings
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-red-800 dark:text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email Address
                    </div>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your.email@example.com"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter the email address you used when booking your appointments
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      View My Appointments
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Don&apos;t have any appointments yet?
                </p>
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-border px-6 py-2 font-medium hover:bg-muted transition-all"
                >
                  <Calendar className="h-4 w-4" />
                  Book Your First Appointment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Account dashboard view
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-card border rounded-lg shadow-lg p-6 md:p-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">My Account</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{email}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <Link
              href="/book"
              className="bg-primary text-primary-foreground rounded-lg p-6 hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg mb-1">Book New Appointment</div>
                  <div className="text-sm text-primary-foreground/80">
                    Schedule your next salon visit
                  </div>
                </div>
                <Calendar className="w-8 h-8" />
              </div>
            </Link>

            <Link
              href="/contact"
              className="bg-card border rounded-lg p-6 hover:bg-muted/50 transition-all shadow-md hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg mb-1">Contact Salon</div>
                  <div className="text-sm text-muted-foreground">
                    Get in touch with us
                  </div>
                </div>
                <Phone className="w-8 h-8 text-muted-foreground" />
              </div>
            </Link>
          </div>

          {/* Upcoming Appointments */}
          {upcomingAppointments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Upcoming Appointments</h2>
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    isPast={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Appointments */}
          {pastAppointments.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Past Appointments</h2>
              <div className="space-y-4">
                {pastAppointments.slice(0, 5).map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    isPast={true}
                  />
                ))}
              </div>
              {pastAppointments.length > 5 && (
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Showing 5 of {pastAppointments.length} past appointments
                </div>
              )}
            </div>
          )}

          {/* No Appointments */}
          {appointments.length === 0 && !loading && (
            <div className="bg-card border rounded-lg p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Appointments Found</h3>
              <p className="text-muted-foreground mb-6">
                You don&apos;t have any appointments yet. Book your first appointment today!
              </p>
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-all"
              >
                <Calendar className="h-5 w-5" />
                Book Appointment
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
