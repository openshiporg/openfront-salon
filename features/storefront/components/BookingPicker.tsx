"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import type { BookingSlot } from "../lib/data/availability"
import { getDaysSlots } from "../lib/data/next-available"
import { useWide } from "../lib/use-wide"
import { addDaysKey, bookHref, dayNumber, rangeLabel, splitSlotLabel, weekdayShort } from "../lib/picker-dates"

export interface PickerStylist {
  id: string
  name: string
  title: string
  photo: string | null
  photoAlt: string
  /** The service availability is read for: the page's service, or the stylist's first on the menu. */
  serviceId: string
  duration: number
  workDays: number[]
}

/** Per day: undefined while unread, null when the read failed. */
type WeekDays = Record<string, BookingSlot[] | null | undefined>

/**
 * Booking-first picker: choose a stylist, then a day in the week and an open time.
 * A time hands off to /book with the stylist, day and time filled in.
 */
export function BookingPicker({
  stylists,
  today,
  locationId,
  linkService = false,
  timesShown = 2,
}: {
  stylists: PickerStylist[]
  today: string
  locationId: string | null
  /** Include the service in the hand-off (on a service page the service is already chosen). */
  linkService?: boolean
  timesShown?: number
}) {
  const [stylistId, setStylistId] = useState(stylists[0]?.id ?? null)
  const stylist = stylists.find((item) => item.id === stylistId) ?? null
  const [week, setWeek] = useState(0)
  const [day, setDay] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [read, setRead] = useState<WeekDays>({})

  const weekStart = addDaysKey(today, week * 7)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysKey(weekStart, index)), [weekStart])

  const wide = useWide()
  useEffect(() => {
    if (!stylist || !wide) return
    let cancelled = false
    setRead({})
    getDaysSlots({ stylistId: stylist.id, serviceId: stylist.serviceId, duration: stylist.duration, locationId, workDays: stylist.workDays }, days)
      .catch(() => Object.fromEntries(days.map((date) => [date, null])) as Record<string, BookingSlot[] | null>)
      .then((result) => {
        if (cancelled) return
        setRead(result)
        setDay((current) => current && result[current]?.length ? current : days.find((date) => result[date]?.length) ?? null)
      })
    return () => { cancelled = true }
  }, [stylist, days, locationId, wide])

  if (!stylist) return null

  const settled = days.every((date) => read[date] !== undefined)
  const failed = settled && days.every((date) => read[date] === null)
  const slots = day ? read[day] || [] : []
  const chooseStylist = (next: PickerStylist) => {
    if (next.id === stylist.id) return
    setStylistId(next.id)
    setWeek(0)
    setDay(null)
  }
  const handoff = (slot?: BookingSlot) => bookHref({ stylistId: stylist.id, serviceId: linkService ? stylist.serviceId : null, date: day, time: slot?.startTime ?? null })

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <p className="sf-label mb-3">Choose a stylist</p>
        <div className="sf-picker-stylists" role="group" aria-label="Stylists">
          {stylists.map((item) => (
            <button key={item.id} type="button" className="sf-stylist-pick" aria-pressed={item.id === stylist.id} onClick={() => chooseStylist(item)}>
              <span className="sf-arch">
                {item.photo ? <img src={item.photo} alt={item.photoAlt} /> : <span className="sf-arch-placeholder" aria-hidden="true">{item.name.charAt(0)}</span>}
              </span>
              <span className="min-w-0">
                <span className="sf-stylist-pick-name truncate">{item.name.split(" ")[0]}</span>
                <span className="sf-stylist-pick-meta truncate">{item.title}</span>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left" aria-expanded={open} aria-controls="sf-picker-week" onClick={() => setOpen((value) => !value)}>
          <span className="sf-label">Choose a time</span>
          <ChevronDown className={`h-5 w-5 text-[var(--sf-ink-2)] transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        </button>
        {open ? (
          <div id="sf-picker-week" className="sf-week-card mt-2">
            <div className="sf-week-head">
              <button type="button" aria-label="Previous week" disabled={week === 0} onClick={() => { setWeek((value) => Math.max(0, value - 1)); setDay(null) }}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
              <p className="sf-display mr-auto text-[1.375rem]" aria-live="polite">{rangeLabel(days[0], days[6])}</p>
              <button type="button" aria-label="Next week" disabled={week >= 12} onClick={() => { setWeek((value) => value + 1); setDay(null) }}><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <div className="sf-week-days">
              {days.map((date) => {
                const value = read[date]
                const count = value === undefined ? null : value?.length ?? 0
                return (
                  <button key={date} type="button" className="sf-day" aria-pressed={date === day} disabled={count === 0} onClick={() => setDay(date)} aria-label={`${weekdayShort(date)} ${dayNumber(date)}${count === 0 ? ", no times" : count ? `, ${count} times` : ""}`}>
                    {dayNumber(date)}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 min-h-[5.5rem]">
              {!day && !settled ? (
                <p role="status" className="text-[length:var(--sf-text-md)] text-[var(--sf-ink-3)]">Checking times…</p>
              ) : failed ? (
                <p role="alert" className="text-[length:var(--sf-text-md)] text-[var(--sf-ink-3)]">Times couldn&apos;t be loaded. <Link href={handoff()} className="sf-link">Book online</Link></p>
              ) : !day || slots.length === 0 ? (
                <p className="text-[length:var(--sf-text-md)] text-[var(--sf-ink-3)]">No open times this week. <button type="button" className="sf-link" onClick={() => { setWeek((value) => value + 1); setDay(null) }}>Next week</button></p>
              ) : (
                <>
                  <Link href={handoff()} className="text-[length:var(--sf-text-md)] text-[var(--sf-sage-ink)] no-underline hover:underline">
                    {slots.length} {slots.length === 1 ? "time" : "times"} available
                  </Link>
                  <ul className="mt-3 grid grid-cols-2 gap-3">
                    {slots.slice(0, timesShown).map((slot) => {
                      const [clock, period] = splitSlotLabel(slot.label)
                      return (
                        <li key={slot.startTime}>
                          <Link href={handoff(slot)} className="sf-time-pill" aria-label={`Book ${stylist.name.split(" ")[0]} at ${slot.label}`}>
                            {clock}
                            {period ? <small>{period}</small> : null}
                            <ChevronRight aria-hidden="true" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
