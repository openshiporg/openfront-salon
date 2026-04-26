"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"

interface TimeSlot {
  time: string
  available: boolean
}

interface AvailabilityResult {
  stylistId: string
  stylistName: string
  date: string
  slots: TimeSlot[]
}

/**
 * Get available time slots for a stylist on a given date
 * Uses the checkAvailability GraphQL query
 */
export async function getAvailableTimeSlots(
  stylistId: string,
  date: string,
  serviceDuration: number
): Promise<string[]> {
  const CHECK_AVAILABILITY = gql`
    query CheckAvailability($stylistId: ID!, $date: String!, $serviceDuration: Int!) {
      checkAvailability(stylistId: $stylistId, date: $date, serviceDuration: $serviceDuration) {
        stylistId
        stylistName
        date
        slots {
          time
          available
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ checkAvailability: AvailabilityResult }>(
      CHECK_AVAILABILITY,
      { stylistId, date, serviceDuration }
    )

    // Filter to only available slots and return just the time strings
    return data.checkAvailability.slots
      .filter((slot) => slot.available)
      .map((slot) => slot.time)
  } catch (error) {
    console.error("Error checking availability:", error)
    return []
  }
}

/**
 * Get availability for multiple stylists on a given date
 */
export async function getMultipleStylistAvailability(
  stylistIds: string[],
  date: string,
  serviceDuration: number
): Promise<Record<string, string[]>> {
  const results: Record<string, string[]> = {}

  // Query each stylist in parallel
  await Promise.all(
    stylistIds.map(async (stylistId) => {
      const slots = await getAvailableTimeSlots(stylistId, date, serviceDuration)
      results[stylistId] = slots
    })
  )

  return results
}

/**
 * Check if a specific time slot is available
 */
export async function isTimeSlotAvailable(
  stylistId: string,
  date: string,
  time: string,
  serviceDuration: number
): Promise<boolean> {
  const slots = await getAvailableTimeSlots(stylistId, date, serviceDuration)
  return slots.includes(time)
}

/**
 * Get next available date for a stylist
 * Checks the next 30 days
 */
export async function getNextAvailableDate(
  stylistId: string,
  serviceDuration: number
): Promise<string | null> {
  const today = new Date()

  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() + i)
    const dateString = checkDate.toISOString().split("T")[0]

    const slots = await getAvailableTimeSlots(stylistId, dateString, serviceDuration)
    if (slots.length > 0) {
      return dateString
    }
  }

  return null
}
