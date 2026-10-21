/**
 * Client-side helper functions for stylist data
 * These are NOT server actions - they're pure utility functions
 */

export type StylistSchedule = {
  id: string
  dayOfWeek: number | null
  startTime: string
  endTime: string
  isAvailable: boolean
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: string | null): string {
  const tierNames: Record<string, string> = {
    junior: "Junior Stylist",
    senior: "Senior Stylist",
    master: "Master Stylist",
    celebrity: "Celebrity Stylist",
  }
  return tier ? tierNames[tier] || tier : "Stylist"
}

/**
 * Get available days for a stylist
 */
export function getAvailableDays(schedules: StylistSchedule[]): string[] {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return schedules
    .filter((s) => s.isAvailable)
    .flatMap((s) => s.dayOfWeek == null ? [] : [dayNames[s.dayOfWeek]])
    .filter(Boolean)
}
