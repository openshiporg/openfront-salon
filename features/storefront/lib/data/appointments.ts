"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"
import { cache } from "react"
import { sendAppointmentConfirmation } from "@/features/keystone/lib/mail"

export interface Appointment {
  id: string
  appointmentDate: string
  totalDuration: number
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "no_show" | "cancelled" | "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" | "CANCELLED"
  bookedAt: string
  confirmedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  clientNotes: string | null
  internalNotes: string | null
  client: {
    id: string
    name?: string
    email?: string
    phone?: string
    user: {
      name: string
      email: string
      phone: string
    } | null
  } | null
  stylist: {
    id: string
    tier: string
    specialties?: string[]
    user: {
      name: string
    } | null
  } | null
  service?: {
    id: string
    name: string
    basePrice: number
    baseDuration: number
  }
  services: {
    id: string
    name: string
    basePrice: number
    baseDuration: number
  }[]
  payment: {
    id: string
    totalAmount: number
    status: string
    paymentMethod: string
  } | null
}

export interface CreateAppointmentInput {
  appointmentDate: string
  clientId: string
  stylistId: string
  serviceIds: string[]
  clientNotes?: string
}

/**
 * Create a new appointment
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment | null> {
  const CREATE_APPOINTMENT = gql`
    mutation CreateAppointment($data: AppointmentCreateInput!) {
      createAppointment(data: $data) {
        id
        appointmentDate
        totalDuration
        status
        bookedAt
        client {
          id
          user {
            name
            email
          }
        }
        stylist {
          id
          user {
            name
          }
        }
        services {
          id
          name
          basePrice
          baseDuration
        }
      }
    }
  `

  // Calculate total duration from services
  const servicesData = await getServiceDurations(input.serviceIds)
  const totalDuration = servicesData.reduce((sum, s) => sum + s.baseDuration, 0)

  const data = {
    appointmentDate: input.appointmentDate,
    totalDuration,
    status: "scheduled",
    client: { connect: { id: input.clientId } },
    stylist: { connect: { id: input.stylistId } },
    services: { connect: input.serviceIds.map((id) => ({ id })) },
    clientNotes: input.clientNotes || null,
  }

  try {
    const result = await salonClient.request<{ createAppointment: Appointment }>(CREATE_APPOINTMENT, { data })
    const appointment = result.createAppointment

    // Send confirmation email
    if (appointment && appointment.client?.user?.email) {
      try {
        const appointmentDate = new Date(appointment.appointmentDate)
        const dateStr = appointmentDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        const timeStr = appointmentDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })

        const totalPrice = appointment.services.reduce((sum, s) => sum + s.basePrice, 0)

        await sendAppointmentConfirmation({
          to: appointment.client.user.email,
          clientName: appointment.client.user.name,
          serviceName: appointment.services.map(s => s.name).join(", "),
          stylistName: appointment.stylist?.user?.name || "Our Team",
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          duration: appointment.totalDuration,
          price: totalPrice,
        })
      } catch (emailError) {
        console.error("Failed to send appointment confirmation email:", emailError)
        // Don't fail the appointment creation if email fails
      }
    }

    return appointment
  } catch (error) {
    console.error("Error creating appointment:", error)
    return null
  }
}

/**
 * Get service durations for total calculation
 */
async function getServiceDurations(serviceIds: string[]): Promise<{ id: string; baseDuration: number }[]> {
  const GET_SERVICE_DURATIONS = gql`
    query GetServiceDurations($ids: [ID!]!) {
      services(where: { id: { in: $ids } }) {
        id
        baseDuration
      }
    }
  `

  try {
    const data = await salonClient.request<{ services: { id: string; baseDuration: number }[] }>(
      GET_SERVICE_DURATIONS,
      { ids: serviceIds }
    )
    return data.services
  } catch (error) {
    console.error("Error fetching service durations:", error)
    return []
  }
}

/**
 * Get appointments for a specific client by ID
 */
export const getClientAppointments = cache(async function (clientId: string): Promise<Appointment[]> {
  const GET_CLIENT_APPOINTMENTS = gql`
    query GetClientAppointments($clientId: ID!) {
      appointments(
        where: { client: { id: { equals: $clientId } } }
        orderBy: { appointmentDate: desc }
      ) {
        id
        appointmentDate
        totalDuration
        status
        bookedAt
        clientNotes
        stylist {
          id
          tier
          user {
            name
          }
        }
        services {
          id
          name
          basePrice
          baseDuration
        }
        payment {
          id
          totalAmount
          status
          paymentMethod
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_CLIENT_APPOINTMENTS, { clientId })
    return data.appointments
  } catch (error) {
    console.error("Error fetching client appointments:", error)
    return []
  }
})

/**
 * Get appointments for a client by email
 */
export const getClientAppointmentsByEmail = cache(async function (email: string): Promise<Appointment[]> {
  const GET_CLIENT_APPOINTMENTS_BY_EMAIL = gql`
    query GetClientAppointmentsByEmail($email: String!) {
      appointments(
        where: { client: { user: { email: { equals: $email } } } }
        orderBy: { appointmentDate: desc }
      ) {
        id
        appointmentDate
        totalDuration
        status
        bookedAt
        clientNotes
        stylist {
          id
          tier
          user {
            name
          }
        }
        services {
          id
          name
          basePrice
          baseDuration
        }
        payment {
          id
          totalAmount
          status
          paymentMethod
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_CLIENT_APPOINTMENTS_BY_EMAIL, { email })
    return data.appointments
  } catch (error) {
    console.error("Error fetching client appointments by email:", error)
    return []
  }
})

/**
 * Get a single appointment by ID
 */
export const getAppointmentById = cache(async function (appointmentId: string): Promise<Appointment | null> {
  const GET_APPOINTMENT = gql`
    query GetAppointment($id: ID!) {
      appointment(where: { id: $id }) {
        id
        appointmentDate
        totalDuration
        status
        bookedAt
        confirmedAt
        cancelledAt
        cancellationReason
        clientNotes
        internalNotes
        client {
          id
          user {
            name
            email
            phone
          }
        }
        stylist {
          id
          tier
          specialties
          user {
            name
          }
        }
        services {
          id
          name
          basePrice
          baseDuration
        }
        payment {
          id
          totalAmount
          status
          paymentMethod
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointment: Appointment | null }>(GET_APPOINTMENT, { id: appointmentId })
    return data.appointment
  } catch (error) {
    console.error("Error fetching appointment:", error)
    return null
  }
})

/**
 * Get appointments for a specific stylist on a given date
 */
export const getStylistAppointmentsForDate = cache(async function (
  stylistId: string,
  date: string
): Promise<Appointment[]> {
  // Create date range for the entire day
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const GET_STYLIST_APPOINTMENTS = gql`
    query GetStylistAppointments($stylistId: ID!, $startDate: DateTime!, $endDate: DateTime!) {
      appointments(
        where: {
          stylist: { id: { equals: $stylistId } }
          appointmentDate: { gte: $startDate, lte: $endDate }
          status: { notIn: ["cancelled", "no_show"] }
        }
        orderBy: { appointmentDate: asc }
      ) {
        id
        appointmentDate
        totalDuration
        status
        services {
          id
          name
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_STYLIST_APPOINTMENTS, {
      stylistId,
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    })
    return data.appointments
  } catch (error) {
    console.error("Error fetching stylist appointments:", error)
    return []
  }
})

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: string, reason: string): Promise<boolean> {
  const CANCEL_APPOINTMENT = gql`
    mutation CancelAppointment($id: ID!, $data: AppointmentUpdateInput!) {
      updateAppointment(where: { id: $id }, data: $data) {
        id
        status
        cancelledAt
        cancellationReason
      }
    }
  `

  try {
    await salonClient.request(CANCEL_APPOINTMENT, {
      id: appointmentId,
      data: {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason,
      },
    })
    return true
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    return false
  }
}

/**
 * Get available time slots for a stylist on a given date
 */
export async function getAvailableTimeSlots(
  stylistId: string,
  date: string,
  serviceDuration: number
): Promise<string[]> {
  // Get stylist's schedule for the day
  const dayOfWeek = new Date(date).getDay()

  const GET_STYLIST_SCHEDULE = gql`
    query GetStylistSchedule($stylistId: ID!, $dayOfWeek: Int!) {
      stylistSchedules(
        where: {
          stylist: { id: { equals: $stylistId } }
          dayOfWeek: { equals: $dayOfWeek }
          isAvailable: { equals: true }
        }
      ) {
        startTime
        endTime
      }
    }
  `

  try {
    const scheduleData = await salonClient.request<{
      stylistSchedules: { startTime: string; endTime: string }[]
    }>(GET_STYLIST_SCHEDULE, { stylistId, dayOfWeek })

    if (scheduleData.stylistSchedules.length === 0) {
      return [] // Stylist not available on this day
    }

    // Get existing appointments for the day
    const appointments = await getStylistAppointmentsForDate(stylistId, date)

    // Generate available slots based on schedule and existing appointments
    const schedule = scheduleData.stylistSchedules[0]
    const slots = generateTimeSlots(schedule.startTime, schedule.endTime, serviceDuration, appointments)

    return slots
  } catch (error) {
    console.error("Error getting available time slots:", error)
    return []
  }
}

/**
 * Generate available time slots
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  serviceDuration: number,
  existingAppointments: Appointment[]
): string[] {
  const slots: string[] = []
  const slotInterval = 30 // 30-minute slots

  // Parse times (assuming format "HH:MM")
  const [startHour, startMin] = startTime.split(":").map(Number)
  const [endHour, endMin] = endTime.split(":").map(Number)

  let currentHour = startHour
  let currentMin = startMin

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMin + serviceDuration <= endMin)
  ) {
    const timeString = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`

    // Check if this slot conflicts with existing appointments
    const slotStart = currentHour * 60 + currentMin
    const slotEnd = slotStart + serviceDuration

    const hasConflict = existingAppointments.some((apt) => {
      const aptDate = new Date(apt.appointmentDate)
      const aptStart = aptDate.getHours() * 60 + aptDate.getMinutes()
      const aptEnd = aptStart + apt.totalDuration

      return slotStart < aptEnd && slotEnd > aptStart
    })

    if (!hasConflict) {
      // Format for display
      const displayHour = currentHour % 12 || 12
      const ampm = currentHour < 12 ? "AM" : "PM"
      slots.push(`${displayHour}:${String(currentMin).padStart(2, "0")} ${ampm}`)
    }

    // Move to next slot
    currentMin += slotInterval
    if (currentMin >= 60) {
      currentHour += 1
      currentMin -= 60
    }
  }

  return slots
}
