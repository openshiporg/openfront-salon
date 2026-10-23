"use client"

import { useEffect, useState } from "react"
import { rescheduleOwnedAppointment } from "../account/actions"
import { getAvailableTimeSlots, type BookingSlot } from "../lib/data/availability"
import { TimeSlotPicker } from "./TimeSlotPicker"

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** Reschedule by picking an open slot for the same stylist, service and location. */
export function RescheduleForm({ appointmentId, idempotencyKey, timeZone, stylistId, locationId, serviceId, duration }: {
  appointmentId: string
  idempotencyKey: string
  timeZone: string
  stylistId: string
  locationId?: string | null
  serviceId?: string | null
  duration: number
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [slots, setSlots] = useState<BookingSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSelectedTime(null)
    setSlots([])
    setFailed(false)
    if (!selectedDate) return
    setLoading(true)
    getAvailableTimeSlots(stylistId, localDateKey(selectedDate), duration, serviceId || undefined, locationId || undefined)
      .then((result) => { if (!cancelled) setSlots(result) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedDate, stylistId, duration, serviceId, locationId])

  return (
    <form action={rescheduleOwnedAppointment} className="grid min-w-0 gap-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="startTime" value={selectedTime || ""} />
      <TimeSlotPicker
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        selectedTime={selectedTime}
        onTimeSelect={setSelectedTime}
        availableSlots={slots}
        loadingSlots={loading}
      />
      {failed ? <p role="alert" className="sf-alert">Availability couldn&apos;t be checked. Try again.</p> : null}
      <div className="sf-track sf-track-block">
        <button className="sf-btn sf-btn-primary" type="submit" disabled={!selectedTime}>Move appointment</button>
      </div>
    </form>
  )
}
