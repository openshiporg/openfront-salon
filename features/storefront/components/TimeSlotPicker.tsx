"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { addDays, isBefore, isSameDay, startOfDay } from "date-fns"
import type { BookingSlot } from "../lib/data/availability"

interface TimeSlotPickerProps {
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  selectedTime: string | null
  onTimeSelect: (startTime: string) => void
  availableSlots: BookingSlot[]
  loadingSlots?: boolean
}

const STRIP_DAYS = 21

function slotPeriod(label: string): "Morning" | "Afternoon" | "Evening" | null {
  const match = label.match(/(\d{1,2})(?::\d{2})?\s*([AaPp])\.?[Mm]/)
  if (!match) return null
  const hour = (Number(match[1]) % 12) + (match[2].toLowerCase() === "p" ? 12 : 0)
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
}

/** A horizontal strip of days, then the open times for the chosen day grouped by part of day. */
export function TimeSlotPicker({
  selectedDate,
  onDateSelect,
  selectedTime,
  onTimeSelect,
  availableSlots,
  loadingSlots = false,
}: TimeSlotPickerProps) {
  // "Today" depends on the browser clock, so the strip is built after mount; the server render
  // (UTC) would otherwise label a different day and break hydration.
  const [todayTime, setTodayTime] = useState<number | null>(null)
  useEffect(() => { setTodayTime(startOfDay(new Date()).getTime()) }, [])
  const today = new Date(todayTime ?? 0)
  const maxDate = addDays(today, 90)
  const [showCalendar, setShowCalendar] = useState(false)
  const strip = useMemo(() => todayTime === null ? [] : Array.from({ length: STRIP_DAYS }, (_, index) => addDays(new Date(todayTime), index)), [todayTime])
  const disabledDates = (date: Date) => isBefore(date, today) || date > maxDate
  const outsideStrip = selectedDate && strip.length > 0 && !strip.some((day) => isSameDay(day, selectedDate))
  const monthLabel = (selectedDate || (todayTime === null ? null : today))?.toLocaleDateString("en-US", { month: "long", year: "numeric" }) || "\u00a0"

  const groups = useMemo(() => {
    const ordered: Array<{ label: string; slots: BookingSlot[] }> = []
    for (const slot of availableSlots) {
      const label = slotPeriod(slot.label) || "Times"
      const existing = ordered.find((group) => group.label === label)
      if (existing) existing.slots.push(slot)
      else ordered.push({ label, slots: [slot] })
    }
    return ordered
  }, [availableSlots])

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[var(--sf-space-lg)]">
      <div className="min-w-0">
        <div className="sf-bk-subhead">
          <h2 className="sf-bk-subhead-title">{monthLabel}</h2>
          <button type="button" className="sf-bk-textbtn" aria-expanded={showCalendar} onClick={() => setShowCalendar((value) => !value)}>
            {showCalendar ? "Hide calendar" : "Calendar"}
          </button>
        </div>
        <div className="sf-bk-dates" aria-busy={todayTime === null}>
          {todayTime === null ? Array.from({ length: 7 }, (_, index) => <span key={index} aria-hidden="true" className="sf-bk-date opacity-40"><small>&nbsp;</small><strong>&nbsp;</strong></span>) : null}
          {strip.map((day) => {
            const selected = Boolean(selectedDate && isSameDay(day, selectedDate))
            return (
              <button key={day.toISOString()} type="button" aria-pressed={selected} onClick={() => onDateSelect(day)} className="sf-bk-date" data-date-option aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
                <small>{isSameDay(day, today) ? "Today" : day.toLocaleDateString("en-US", { weekday: "short" })}</small>
                <strong>{day.getDate()}</strong>
              </button>
            )
          })}
        </div>
        {outsideStrip ? (
          <p className="mt-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink)]">{selectedDate!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        ) : null}
        {showCalendar ? (
          <div className="sf-bk-calendar">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => { onDateSelect(date); if (date) setShowCalendar(false) }}
              disabled={disabledDates}
              className="p-0"
              classNames={{ day_button: "!rounded-[0.5rem]" }}
            />
          </div>
        ) : null}
      </div>

      <div className="min-w-0" aria-live="polite">
        {!selectedDate ? (
          <p className="sf-bk-empty">Choose a day to see open times.</p>
        ) : loadingSlots ? (
          <p role="status" className="sf-bk-empty"><span className="sf-spinner" aria-hidden="true" />Checking open times…</p>
        ) : availableSlots.length === 0 ? (
          <p className="sf-bk-empty">No open times this day. Try another day.</p>
        ) : (
          <div className="grid gap-[var(--sf-space-md)]">
            {groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                <p className="sf-bk-period">{group.label}</p>
                <div className="sf-bk-slots">
                  {group.slots.map((slot) => (
                    <button key={slot.startTime} type="button" aria-pressed={selectedTime === slot.startTime} onClick={() => onTimeSelect(slot.startTime)} className="sf-bk-slot" data-slot-option>
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
