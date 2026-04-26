"use client"

import { Calendar } from "@/components/ui/calendar"
import { format, addDays, startOfDay, isBefore } from "date-fns"
import { Clock } from "lucide-react"
import { useState } from "react"

interface TimeSlotPickerProps {
  selectedDate: Date | undefined
  onDateSelect: (date: Date | undefined) => void
  selectedTime: string | null
  onTimeSelect: (time: string) => void
  availableSlots: string[]
  loadingSlots?: boolean
  minDate?: Date
}

export function TimeSlotPicker({
  selectedDate,
  onDateSelect,
  selectedTime,
  onTimeSelect,
  availableSlots,
  loadingSlots = false,
  minDate = new Date()
}: TimeSlotPickerProps) {
  const today = startOfDay(new Date())
  const maxDate = addDays(today, 90) // 90 days in advance

  const disabledDates = (date: Date) => {
    return isBefore(date, today) || date > maxDate
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="font-semibold text-lg mb-4">Select a Date</h3>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          disabled={disabledDates}
          className="rounded-md"
        />
      </div>

      {/* Time Slots */}
      <div className="border rounded-lg p-6 bg-card">
        <h3 className="font-semibold text-lg mb-4">Select a Time</h3>
        {!selectedDate ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Please select a date first</p>
          </div>
        ) : loadingSlots ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 text-muted-foreground/50" />
            <p className="text-center">No available time slots for this date.</p>
            <p className="text-sm text-center mt-1">Please select a different date.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {availableSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => onTimeSelect(slot)}
                className={`p-3 text-sm font-medium rounded-md border transition-all ${
                  selectedTime === slot
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border hover:border-primary/50"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
