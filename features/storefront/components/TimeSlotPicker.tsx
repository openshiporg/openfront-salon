"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { addDays, isBefore, isSameDay, startOfDay } from "date-fns"
import { CalendarDays, Clock } from "lucide-react"
import type { BookingSlot } from "../lib/data/availability"

interface TimeSlotPickerProps {
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  selectedTime: string | null
  onTimeSelect: (startTime: string) => void
  availableSlots: BookingSlot[]
  loadingSlots?: boolean
}

const STRIP_DAYS = 14

function slotPeriod(label: string): "Morning" | "Afternoon" | "Evening" | null {
  const match = label.match(/(\d{1,2})(?::\d{2})?\s*([AaPp])\.?[Mm]/)
  if (!match) return null
  const hour = (Number(match[1]) % 12) + (match[2].toLowerCase() === "p" ? 12 : 0)
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
}

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
  const outsideStrip = selectedDate && !strip.some((day) => isSameDay(day, selectedDate))

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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[var(--sf-space-md)]">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="sf-eyebrow">Date</h3>
          <div className="sf-track">
            <button type="button" className="sf-btn sf-btn-sm sf-btn-quiet" aria-expanded={showCalendar} onClick={() => setShowCalendar((value) => !value)}>
              <CalendarDays aria-hidden="true" />
              {showCalendar ? "Hide calendar" : "More dates"}
            </button>
          </div>
        </div>
        <div className="sf-track sf-track-scroll !flex !rounded-[var(--sf-radius-md)]">
          <div className="sf-date-strip" aria-busy={todayTime === null}>
            {todayTime === null ? Array.from({ length: 7 }, (_, index) => <span key={index} aria-hidden="true" className="sf-date opacity-40"><small>&nbsp;</small><strong>&nbsp;</strong><small>&nbsp;</small></span>) : null}
            {strip.map((day) => {
              const selected = Boolean(selectedDate && isSameDay(day, selectedDate))
              return (
                <button key={day.toISOString()} type="button" aria-pressed={selected} onClick={() => onDateSelect(day)} className="sf-date" aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
                  <small>{isSameDay(day, today) ? "Today" : day.toLocaleDateString("en-US", { weekday: "short" })}</small>
                  <strong>{day.getDate()}</strong>
                  <small className="!font-medium !normal-case !tracking-normal opacity-70">{day.toLocaleDateString("en-US", { month: "short" })}</small>
                </button>
              )
            })}
          </div>
        </div>
        {outsideStrip ? (
          <p className="mt-2 text-[length:var(--sf-text-sm)] font-semibold">{selectedDate!.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        ) : null}
        {showCalendar ? (
          <div className="sf-card mt-3 inline-block p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => { onDateSelect(date); if (date) setShowCalendar(false) }}
              disabled={disabledDates}
              className="p-0"
            />
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <h3 className="sf-eyebrow mb-3">Time</h3>
        {!selectedDate ? (
          <div className="sf-slot-well flex min-h-28 items-center justify-center text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">Choose a date</div>
        ) : loadingSlots ? (
          <div role="status" className="sf-slot-well flex min-h-28 items-center justify-center gap-3 text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--sf-rule-strong)] border-t-[var(--sf-ink)]" aria-hidden="true" />
            Checking availability…
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="sf-slot-well flex min-h-28 flex-col items-center justify-center gap-1 text-center text-[length:var(--sf-text-sm)] text-[var(--sf-ink-3)]">
            <Clock className="mb-1 h-6 w-6 opacity-50" aria-hidden="true" />
            <p className="font-semibold text-[var(--sf-ink-2)]">No openings this day</p>
            <p>Try another date.</p>
          </div>
        ) : (
          <div className="sf-slot-well grid gap-4">
            {groups.map((group) => (
              <div key={group.label}>
                {groups.length > 1 || group.label !== "Times" ? <p className="mb-2 px-1 text-[length:var(--sf-text-xs)] font-semibold text-[var(--sf-ink-3)]">{group.label}</p> : null}
                <div className="sf-slot-grid">
                  {group.slots.map((slot) => (
                    <button key={slot.startTime} type="button" aria-pressed={selectedTime === slot.startTime} onClick={() => onTimeSelect(slot.startTime)} className="sf-slot">
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
