"use server"

import { getAvailableTimeSlots, type BookingSlot } from "./availability"
import { addDaysKey } from "../picker-dates"

export interface NextOpening {
  date: string
  slots: BookingSlot[]
}

export interface OpeningQuery {
  stylistId: string
  serviceId: string
  duration: number
  locationId: string | null
  today: string
  /** Weekdays (0 = Sunday) the stylist works; other days are skipped. Empty or missing reads every day. */
  workDays?: number[]
}

// Each availability read holds a database connection; keep a page's reads to a few at a time.
const PARALLEL = 3

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index])
    }
  }))
  return results
}

async function readDay(query: Omit<OpeningQuery, "today">, date: string): Promise<BookingSlot[] | null> {
  try {
    return await getAvailableTimeSlots(query.stylistId, date, query.duration, query.serviceId, query.locationId || undefined)
  } catch {
    return null
  }
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

async function firstOpening(query: OpeningQuery, horizon: number): Promise<NextOpening | null> {
  const works = query.workDays?.length ? new Set(query.workDays) : null
  for (let offset = 0; offset < horizon; offset += 1) {
    const date = addDaysKey(query.today, offset)
    if (works && !works.has(weekday(date))) continue
    const slots = await readDay(query, date)
    if (slots?.length) return { date, slots }
  }
  return null
}

/** First open salon-local day within `horizon` days, per stylist (one round trip for the page). */
export async function findNextOpenings(queries: OpeningQuery[], horizon = 14): Promise<Array<NextOpening | null>> {
  return inBatches(queries.slice(0, 12), (query) => firstOpening(query, horizon))
}

/** Open slots for each given day; a day that couldn't be read is null. */
export async function getDaysSlots(query: Omit<OpeningQuery, "today">, days: string[]): Promise<Record<string, BookingSlot[]>> {
  const works = query.workDays?.length ? new Set(query.workDays) : null
  const week = days.slice(0, 7)
  const reads = await inBatches(week, (date) => works && !works.has(weekday(date)) ? Promise.resolve([] as BookingSlot[]) : readDay(query, date))
  if (reads.every((slots) => slots === null)) throw new Error("Availability could not be checked.")
  return Object.fromEntries(week.map((date, index) => [date, reads[index] || []]))
}
