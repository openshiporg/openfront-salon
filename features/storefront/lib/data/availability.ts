"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"

export interface BookingSlot {
  label: string
  startTime: string
}

interface AvailabilityResult {
  stylistId: string
  stylistName: string
  date: string
  timezone: string
  slots: {
    time: string
    startTime: string
    available: boolean
  }[]
}

/**
 * Get server-authoritative staff, time-off, appointment, and resource-safe slots.
 */
export async function getAvailableTimeSlots(
  stylistId: string,
  date: string,
  serviceDuration: number,
  serviceId?: string,
  locationId?: string
): Promise<BookingSlot[]> {
  const CHECK_AVAILABILITY = gql`
    query CheckAvailability($stylistId: ID!, $date: String!, $serviceDuration: Int!, $serviceId: ID, $locationId: ID) {
      checkAvailability(
        stylistId: $stylistId
        date: $date
        serviceDuration: $serviceDuration
        serviceId: $serviceId
        locationId: $locationId
      ) {
        stylistId
        stylistName
        date
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
    const data = await salonClient.request<{ checkAvailability: AvailabilityResult }>(
      CHECK_AVAILABILITY,
      { stylistId, date, serviceDuration, serviceId, locationId }
    )
    return data.checkAvailability.slots
      .filter((slot) => slot.available)
      .map((slot) => ({ label: slot.time, startTime: slot.startTime }))
  } catch (error) {
    console.error("Error checking availability:", error)
    throw new Error("Availability could not be checked. Please retry or contact the salon.")
  }
}

export async function getMultipleStylistAvailability(
  stylistIds: string[],
  date: string,
  serviceDuration: number,
  serviceId?: string
): Promise<Record<string, BookingSlot[]>> {
  const results: Record<string, BookingSlot[]> = {}
  await Promise.all(stylistIds.map(async (stylistId) => {
    results[stylistId] = await getAvailableTimeSlots(stylistId, date, serviceDuration, serviceId)
  }))
  return results
}

export async function isTimeSlotAvailable(
  stylistId: string,
  date: string,
  startTime: string,
  serviceDuration: number,
  serviceId?: string
): Promise<boolean> {
  const slots = await getAvailableTimeSlots(stylistId, date, serviceDuration, serviceId)
  return slots.some((slot) => slot.startTime === startTime)
}

export async function getNextAvailableDate(
  stylistId: string,
  serviceDuration: number,
  serviceId?: string
): Promise<string | null> {
  const today = new Date()
  for (let offset = 0; offset < 30; offset += 1) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() + offset)
    const dateString = checkDate.toISOString().split("T")[0]
    if ((await getAvailableTimeSlots(stylistId, dateString, serviceDuration, serviceId)).length) return dateString
  }
  return null
}
