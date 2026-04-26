import { graphql } from "@keystone-6/core"
import { Context } from ".keystone/types"

// Define return type for available time slots
const TimeSlot = graphql.object<{ time: string; available: boolean }>()({
  name: "TimeSlot",
  fields: {
    time: graphql.field({ type: graphql.nonNull(graphql.String) }),
    available: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
  },
})

const AvailabilityResult = graphql.object<{
  stylistId: string
  stylistName: string
  date: string
  slots: { time: string; available: boolean }[]
}>()({
  name: "AvailabilityResult",
  fields: {
    stylistId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    stylistName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    date: graphql.field({ type: graphql.nonNull(graphql.String) }),
    slots: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(TimeSlot))) }),
  },
})

// Helper function to parse time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Helper function to convert minutes to time string
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const period = hours >= 12 ? "PM" : "AM"
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`
}

// Buffer time between appointments (in minutes)
const BUFFER_TIME = 15

export const checkAvailability = graphql.field({
  type: AvailabilityResult,
  args: {
    stylistId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    date: graphql.arg({ type: graphql.nonNull(graphql.String) }), // YYYY-MM-DD format
    serviceDuration: graphql.arg({ type: graphql.nonNull(graphql.Int) }), // Duration in minutes
  },
  async resolve(source, args, context: Context) {
    const { stylistId, date, serviceDuration } = args

    // Get stylist info
    const stylist = await context.query.Stylist.findOne({
      where: { id: stylistId },
      query: "id user { name }",
    })

    if (!stylist) {
      throw new Error("Stylist not found")
    }

    const stylistName = stylist.user?.name || "Unknown Stylist"

    // Get the day of week for the requested date
    const requestedDate = new Date(date)
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayOfWeek = daysOfWeek[requestedDate.getDay()]

    // Get stylist's schedule for that day
    const schedules = await context.query.StylistSchedule.findMany({
      where: {
        stylist: { id: { equals: stylistId } },
        dayOfWeek: { equals: dayOfWeek },
        isAvailable: { equals: true },
      },
      query: "id startTime endTime breakStart breakEnd",
    })

    if (schedules.length === 0) {
      return {
        stylistId,
        stylistName,
        date,
        slots: [],
      }
    }

    const schedule = schedules[0]

    // Get existing appointments for that stylist on that date
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const appointments = await context.query.Appointment.findMany({
      where: {
        stylist: { id: { equals: stylistId } },
        appointmentDate: {
          gte: startOfDay.toISOString(),
          lte: endOfDay.toISOString(),
        },
        status: {
          notIn: ["cancelled", "no_show"],
        },
      },
      query: "id appointmentDate totalDuration",
    })

    // Generate all possible time slots
    const scheduleStart = timeToMinutes(schedule.startTime)
    const scheduleEnd = timeToMinutes(schedule.endTime)
    const breakStart = schedule.breakStart ? timeToMinutes(schedule.breakStart) : null
    const breakEnd = schedule.breakEnd ? timeToMinutes(schedule.breakEnd) : null

    const slots: { time: string; available: boolean }[] = []

    // Generate 30-minute slots
    for (let slotStart = scheduleStart; slotStart + serviceDuration <= scheduleEnd; slotStart += 30) {
      const slotEnd = slotStart + serviceDuration + BUFFER_TIME

      // Check if slot overlaps with break
      let duringBreak = false
      if (breakStart !== null && breakEnd !== null) {
        duringBreak = slotStart < breakEnd && slotEnd > breakStart
      }

      // Check if slot overlaps with existing appointments
      let conflictsWithAppointment = false
      for (const appointment of appointments) {
        const appointmentDate = new Date(appointment.appointmentDate)
        const appointmentStart = appointmentDate.getHours() * 60 + appointmentDate.getMinutes()
        const appointmentEnd = appointmentStart + appointment.totalDuration + BUFFER_TIME

        if (slotStart < appointmentEnd && slotEnd > appointmentStart) {
          conflictsWithAppointment = true
          break
        }
      }

      const timeString = minutesToTime(slotStart)
      slots.push({
        time: timeString,
        available: !duringBreak && !conflictsWithAppointment,
      })
    }

    return {
      stylistId,
      stylistName,
      date,
      slots,
    }
  },
})

// Export the extended schema
export const availabilityExtension = graphql.extend((base) => ({
  query: {
    checkAvailability,
  },
}))
