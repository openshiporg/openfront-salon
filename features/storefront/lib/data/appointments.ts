"use server"

import { cache } from "react"
import { gql } from "graphql-request"
import { requestSalon } from "../session-client"
import { resolveBookingSubmitOutcome } from "./bookingSubmitOutcome"
import { getStylistById } from "./stylists"
const salonClient = { request: requestSalon }

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled"

interface AppointmentService {
  id: string
  name: string
  basePrice: number
  baseDuration: number
}

interface AppointmentStylist {
  id: string
  tier: string
  specializations?: { id: string; name: string }[]
  specialties?: string[]
  user: {
    name: string
  } | null
}

export interface Appointment {
  id: string
  startTime: string
  endTime: string | null
  duration: number
  status: AppointmentStatus
  bookedAt: string | null
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
      phone?: string
    } | null
  } | null
  stylist: AppointmentStylist | null
  location: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    timezone?: string
  } | null
  service?: AppointmentService | null
  services: AppointmentService[]
  lineItems?: { id: string; serviceTitle: string; price: number; duration: number; service: { id: string } | null }[]
}

export interface CreateAppointmentInput {
  locationId?: string
  policyAccepted?: boolean
  policyVersion?: string
  requestKey?: string
  startTime: string
  stylistId: string
  serviceIds: string[]
  clientName: string
  clientEmail: string
  clientPhone?: string
  clientNotes?: string
}

export type CreateAppointmentResult =
  | { status: "accepted"; appointmentId: string }
  | { status: "rejected"; error: string }
  | { status: "unresolved" }

const APPOINTMENT_SELECTION = gql`
  id
  startTime
  endTime
  duration
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
    specializations {
      id
      name
    }
    user {
      name
    }
  }
  location {
    id
    name
    address
    city
    state
    zipCode
    timezone
  }
  services {
    id
    name
    basePrice: price
    baseDuration
  }
  lineItems { id serviceTitle price duration service { id } }
`

function normalizeAppointment(appointment: Appointment): Appointment {
  const snapshotServices = appointment.lineItems?.map(line => ({ id: line.service?.id || line.id, name: line.serviceTitle, basePrice: line.price, baseDuration: line.duration }));
  const services = (snapshotServices || []).map((service) => ({
    ...service,
    basePrice: service.basePrice / 100,
  }))
  const duration = appointment.duration || services.reduce((sum, service) => sum + (service.baseDuration || 0), 0)
  const user = appointment.client?.user || null
  const stylistSpecializations = appointment.stylist?.specializations || []

  return {
    ...appointment,
    duration,
    status: (appointment.status || "pending") as AppointmentStatus,
    services,
    service: services[0] || null,
    client: appointment.client
      ? {
          ...appointment.client,
          name: appointment.client.name || user?.name,
          email: appointment.client.email || user?.email,
          phone: appointment.client.phone || user?.phone,
        }
      : null,
    stylist: appointment.stylist
      ? {
          ...appointment.stylist,
          specialties:
            appointment.stylist.specialties ||
            stylistSpecializations.map((specialization) => specialization.name),
        }
      : null,
  }
}

/**
 * Create a new appointment request through the public-safe booking mutation.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  const BOOK_APPOINTMENT = gql`
    mutation BookAppointment(
      $serviceIds: [ID!]!
      $stylistId: ID!
      $startTime: String!
      $clientName: String!
      $clientEmail: String!
      $clientPhone: String
      $clientNotes: String
      $locationId: ID
      $policyAccepted: Boolean
      $policyVersion: String
      $requestKey: String
    ) {
      bookAppointment(
        serviceIds: $serviceIds
        stylistId: $stylistId
        startTime: $startTime
        clientName: $clientName
        clientEmail: $clientEmail
        clientPhone: $clientPhone
        clientNotes: $clientNotes
        locationId: $locationId
        policyAccepted: $policyAccepted
        policyVersion: $policyVersion
        requestKey: $requestKey
      ) {
        success
        appointmentId
        error
      }
    }
  `

  try {
    const result = await salonClient.request<{ bookAppointment?: unknown }>(BOOK_APPOINTMENT, {
      serviceIds: input.serviceIds,
      stylistId: input.stylistId,
      startTime: input.startTime,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone || null,
      clientNotes: input.clientNotes || null,
      locationId: input.locationId || null,
      policyAccepted: input.policyAccepted === true,
      policyVersion: input.policyVersion || null,
      requestKey: input.requestKey || null,
    })

    const outcome = resolveBookingSubmitOutcome(result?.bookAppointment)
    if (outcome.status === "unresolved") return outcome
    if (outcome.status === "rejected") return outcome

    return { status: "accepted", appointmentId: outcome.appointmentId }
  } catch (error) {
    console.error("Error creating appointment:", error)
    return { status: "unresolved" }
  }
}

/**
 * Get appointments for a specific client by ID.
 */
export const getClientAppointments = cache(async function (clientId: string): Promise<Appointment[]> {
  const GET_CLIENT_APPOINTMENTS = gql`
    query GetClientAppointments($clientId: ID!) {
      appointments(
        where: { client: { id: { equals: $clientId } } }
        orderBy: { startTime: desc }
      ) {
        ${APPOINTMENT_SELECTION}
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_CLIENT_APPOINTMENTS, { clientId })
    return data.appointments.map(normalizeAppointment)
  } catch (error) {
    console.error("Error fetching client appointments:", error)
    return []
  }
})

/**
 * Get appointments for a client by email.
 */
export const getClientAppointmentsByEmail = cache(async function (email: string): Promise<Appointment[]> {
  const GET_CLIENT_APPOINTMENTS_BY_EMAIL = gql`
    query GetClientAppointmentsByEmail($email: String!) {
      appointments(
        where: { client: { user: { email: { equals: $email } } } }
        orderBy: { startTime: desc }
      ) {
        ${APPOINTMENT_SELECTION}
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_CLIENT_APPOINTMENTS_BY_EMAIL, { email })
    return data.appointments.map(normalizeAppointment)
  } catch (error) {
    console.error("Error fetching client appointments by email:", error)
    return []
  }
})

/**
 * Get a single appointment by ID.
 */
export const getAppointmentById = cache(async function (appointmentId: string): Promise<Appointment | null> {
  const GET_APPOINTMENT = gql`
    query GetAppointment($id: ID!) {
      appointment(where: { id: $id }) {
        ${APPOINTMENT_SELECTION}
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointment: Appointment | null }>(GET_APPOINTMENT, { id: appointmentId })
    if (!data.appointment) return null
    // The normal appointment read proves ownership first. Staff display names
    // come from the existing public DTO, never by widening User access.
    if (data.appointment.stylist && !data.appointment.stylist.user?.name) {
      const publicStylist = await getStylistById(data.appointment.stylist.id)
      data.appointment.stylist.user = publicStylist?.user?.name ? { name: publicStylist.user.name } : null
    }
    return normalizeAppointment(data.appointment)
  } catch (error) {
    console.error("Error fetching appointment:", error)
    return null
  }
})

/**
 * Get appointments for a specific stylist on a given date.
 */
export const getStylistAppointmentsForDate = cache(async function (
  stylistId: string,
  date: string
): Promise<Appointment[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const GET_STYLIST_APPOINTMENTS = gql`
    query GetStylistAppointments($stylistId: ID!, $startDate: DateTime!, $endDate: DateTime!) {
      appointments(
        where: {
          stylist: { id: { equals: $stylistId } }
          startTime: { gte: $startDate, lte: $endDate }
          status: { notIn: [cancelled, no_show] }
        }
        orderBy: { startTime: asc }
      ) {
        ${APPOINTMENT_SELECTION}
      }
    }
  `

  try {
    const data = await salonClient.request<{ appointments: Appointment[] }>(GET_STYLIST_APPOINTMENTS, {
      stylistId,
      startDate: startOfDay.toISOString(),
      endDate: endOfDay.toISOString(),
    })
    return data.appointments.map(normalizeAppointment)
  } catch (error) {
    console.error("Error fetching stylist appointments:", error)
    return []
  }
})

/**
 * Available booking slot returned by the server-authoritative scheduling engine.
 */
export type BookingSlot = {
  label: string
  startTime: string
}

/**
 * Get staff, break, time-off, appointment, and resource-safe slots.
 */
export async function getAvailableTimeSlots(
  stylistId: string,
  date: string,
  serviceDuration: number,
  serviceId: string
): Promise<BookingSlot[]> {
  const CHECK_AVAILABILITY = gql`
    query CheckAvailability($stylistId: ID!, $date: String!, $serviceDuration: Int!, $serviceId: ID!) {
      checkAvailability(
        stylistId: $stylistId
        date: $date
        serviceDuration: $serviceDuration
        serviceId: $serviceId
      ) {
        timezone
        slots {
          time
          startTime
          available
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{
      checkAvailability: {
        timezone: string
        slots: { time: string; startTime: string; available: boolean }[]
      }
    }>(CHECK_AVAILABILITY, { stylistId, date, serviceDuration, serviceId })
    return data.checkAvailability.slots
      .filter((slot) => slot.available)
      .map((slot) => ({ label: slot.time, startTime: slot.startTime }))
  } catch (error) {
    console.error("Error getting available time slots:", error)
    return []
  }
}
