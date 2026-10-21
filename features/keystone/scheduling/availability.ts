import type { Context } from ".keystone/types";
import { BOOKING_BUFFER_MINUTES, resourceCapacityAvailable } from "./occupancy";
import { resolveBookableServiceResource } from "./resource-requirements";
export { BOOKING_BUFFER_MINUTES } from "./occupancy";

const SLOT_INTERVAL_MINUTES = 30;
const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"] as const;
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export type AvailabilitySlot = {
  time: string;
  startTime: string;
  available: boolean;
  resourceId: string | null;
  resourceName: string | null;
  blockedReason: string | null;
};

export type StylistAvailability = {
  stylistId: string;
  stylistName: string;
  date: string;
  timezone: string;
  locationId: string | null;
  slots: AvailabilitySlot[];
};

type WallParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

type ScheduleRecord = {
  id: string;
  type: "recurring" | "one_time" | "time_off";
  dayOfWeek?: number | null;
  date?: string | null;
  localDate?: string | null;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  breakStart?: string | null;
  breakEnd?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reason?: string | null;
};

function assertDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Availability date is invalid");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Availability date is invalid");
  return value;
}

export function timeToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Schedule time must use HH:MM");
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, "0")} ${period}`;
}

function validTimeZone(value: unknown): string {
  const timezone = typeof value === "string" && value.trim() ? value.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new Error("Salon timezone is invalid");
  }
}

function wallParts(date: Date, timezone: string): WallParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(value("year")), month: Number(value("month")), day: Number(value("day")),
    hour: Number(value("hour")), minute: Number(value("minute")), second: Number(value("second")), weekday: weekdays[value("weekday")] ?? 0,
  };
}

export function zonedDateKey(date: Date, timezone: string) {
  const parts = wallParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function withinLocationHours(hours: unknown, weekday: number, startMinute: number, endMinute: number) {
  const hourRecords = hours && typeof hours === "object" ? hours as Record<string, { open?: string | null; close?: string | null; closed?: boolean } | null> : {};
  const opening = hourRecords[DAY_KEYS[weekday]];
  if (!opening) return true;
  if (opening.closed) return false;
  if (opening.open && startMinute < timeToMinutes(opening.open)) return false;
  if (opening.close && endMinute > timeToMinutes(opening.close)) return false;
  return true;
}

export function isLocationOpenForInterval(hours: unknown, timezone: string, start: Date, end: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) return false;
  const salonTimezone = validTimeZone(timezone);
  const startParts = wallParts(start, salonTimezone);
  const endParts = wallParts(end, salonTimezone);
  const dateKey = `${startParts.year}-${String(startParts.month).padStart(2, "0")}-${String(startParts.day).padStart(2, "0")}`;
  const endDateKey = `${endParts.year}-${String(endParts.month).padStart(2, "0")}-${String(endParts.day).padStart(2, "0")}`;
  if (dateKey !== endDateKey) return false;
  const startMinute = startParts.hour * 60 + startParts.minute + (startParts.second + start.getUTCMilliseconds() / 1000) / 60;
  const endMinute = endParts.hour * 60 + endParts.minute + (endParts.second + end.getUTCMilliseconds() / 1000) / 60;
  return withinLocationHours(hours, startParts.weekday, startMinute, endMinute);
}

function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function zonedDateTimeToUtc(dateKey: string, minutes: number, timezone: string) {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split("-").map(Number);
  const desiredHour = Math.floor(minutes / 60);
  const desiredMinute = minutes % 60;
  const desiredWall = Date.UTC(year, month - 1, day, desiredHour, desiredMinute, 0, 0);
  let guess = desiredWall;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallParts(new Date(guess), timezone);
    const actualWall = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0, 0);
    const correction = desiredWall - actualWall;
    guess += correction;
    if (correction === 0) break;
  }
  const result = new Date(guess);
  const verified = wallParts(result, timezone);
  if (verified.year !== year || verified.month !== month || verified.day !== day || verified.hour !== desiredHour || verified.minute !== desiredMinute) {
    throw new Error("Selected local time does not exist in the salon timezone");
  }
  return result;
}

export function zonedDayWindow(dateKey: string, timezone: string) {
  return {
    start: zonedDateTimeToUtc(dateKey, 0, timezone),
    end: zonedDateTimeToUtc(nextDateKey(dateKey), 0, timezone),
  };
}

function scheduleDateKey(schedule: Pick<ScheduleRecord, "localDate" | "date">) {
  if (schedule.localDate && /^\d{4}-\d{2}-\d{2}$/.test(schedule.localDate)) return schedule.localDate;
  if (!schedule.date) return null;
  const date = new Date(schedule.date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function withinEffectiveRange(schedule: ScheduleRecord, dateKey: string) {
  const from = schedule.effectiveFrom ? new Date(schedule.effectiveFrom).toISOString().slice(0, 10) : null;
  const to = schedule.effectiveTo ? new Date(schedule.effectiveTo).toISOString().slice(0, 10) : null;
  return (!from || dateKey >= from) && (!to || dateKey <= to);
}

function overlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function interval(schedule: ScheduleRecord) {
  return { start: timeToMinutes(schedule.startTime), end: timeToMinutes(schedule.endTime) };
}

export async function getRuntimeLocation(sudo: ReturnType<Context["sudo"]>, locationId?: string | null) {
  if (locationId) {
    const location = await sudo.query.Location.findOne({ where: { id: locationId }, query: "id timezone isActive hours" });
    if (!location || location.isActive === false) throw new Error("Location is unavailable");
    return { locationId: location.id, timezone: validTimeZone(location.timezone), hours: location.hours as any };
  }
  const locations = await sudo.query.Location.findMany({
    where: { isActive: { equals: true } }, orderBy: { createdAt: "asc" }, take: 2,
    query: "id timezone hours",
  });
  if (locations.length !== 1) throw new Error(locations.length ? "Choose a salon location" : "No active salon location is configured");
  return { locationId: locations[0].id, timezone: validTimeZone(locations[0].timezone), hours: locations[0].hours as any };
}

export async function computeStylistAvailability({
  sudo,
  stylistId,
  date,
  serviceDuration,
  serviceIds = [],
  locationId: requestedLocationId,
  excludeAppointmentId,
  slotStepMinutes = SLOT_INTERVAL_MINUTES,
}: {
  sudo: ReturnType<Context["sudo"]>;
  stylistId: string;
  date: string;
  serviceDuration: number;
  serviceIds?: string[];
  locationId?: string | null;
  excludeAppointmentId?: string;
  slotStepMinutes?: number;
}): Promise<StylistAvailability> {
  const dateKey = assertDateKey(date);
  if (!Number.isInteger(serviceDuration) || serviceDuration < 1 || serviceDuration > 8 * 60) throw new Error("Service duration is invalid");
  const { locationId, timezone, hours } = await getRuntimeLocation(sudo, requestedLocationId);
  const localNoon = zonedDateTimeToUtc(dateKey, 12 * 60, timezone);
  const requestedWeekday = wallParts(localNoon, timezone).weekday;
  const stylist = await sudo.query.Stylist.findOne({
    where: { id: stylistId }, query: "id status isActive user { name } locations { id }",
  });
  if (!stylist || stylist.status !== "active" || stylist.isActive === false) throw new Error("Stylist is unavailable");
  if (!stylist.locations?.some((location: any) => location.id === locationId)) throw new Error("Stylist is not assigned to this location");

  const schedules = await sudo.query.StylistSchedule.findMany({
    where: { stylist: { id: { equals: stylistId } }, location: { id: { equals: locationId } } }, take: 500,
    query: "id type dayOfWeek localDate date startTime endTime isAvailable breakStart breakEnd effectiveFrom effectiveTo reason",
  }) as ScheduleRecord[];
  const exact = schedules.filter((schedule) => scheduleDateKey(schedule) === dateKey);
  const oneTimeAvailable = exact.filter((schedule) => schedule.type === "one_time" && schedule.isAvailable);
  const recurring = schedules.filter((schedule) => schedule.type === "recurring"
    && schedule.isAvailable && schedule.dayOfWeek === requestedWeekday && withinEffectiveRange(schedule, dateKey));
  const availability = oneTimeAvailable.length ? oneTimeAvailable : recurring;
  const blocks = exact.filter((schedule) => schedule.type === "time_off" || (schedule.type === "one_time" && !schedule.isAvailable));

  const { start: dayStart, end: dayEnd } = zonedDayWindow(dateKey, timezone);
  const appointments = await sudo.query.Appointment.findMany({
    where: {
      stylist: { id: { equals: stylistId } },
      ...(excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}),
      startTime: { lt: dayEnd.toISOString() },
      OR: [{ endTime: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 60_000).toISOString() } }, { endTime: null }],
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    }, take: 2000,
    query: "id startTime duration segments(where: { status: { in: [planned, started] } }) { id }",
  });
  const resourceAppointments = await sudo.query.Appointment.findMany({
    where: {
      ...(excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}),
      startTime: { lt: dayEnd.toISOString() },
      OR: [{ endTime: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 60_000).toISOString() } }, { endTime: null }],
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    }, take: 2000,
    query: "id startTime endTime duration resource { id } segments(where: { status: { in: [planned, started] } }) { id }",
  });
  const segments = await (sudo.query as any).AppointmentSegment.findMany({
    where: { appointment: { status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, ...(excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}) },
      status: { in: ["planned", "started"] }, plannedStart: { lt: dayEnd.toISOString() }, plannedEnd: { gt: new Date(dayStart.getTime() - BOOKING_BUFFER_MINUTES * 60_000).toISOString() } },
    take: 5000, query: "id plannedStart plannedEnd practitioner { id } resource { id } resourceUnits",
  });
  if (appointments.length >= 2000 || resourceAppointments.length >= 2000 || segments.length >= 5000) throw new Error("Schedule is too large to safely evaluate; narrow the operating window");
  const services = serviceIds.length ? await sudo.query.Service.findMany({
    where: { id: { in: [...new Set(serviceIds)] }, status: { equals: "active" } },
    query: "id specialists { id } requiredResources { id name capacity isActive location { id } }",
  }) : [];
  if (serviceIds.length && services.length !== new Set(serviceIds).size) throw new Error("A selected service is unavailable");
  if (services.some((service: any) => !service.specialists.some((person: any) => person.id === stylistId))) throw new Error("Practitioner is not qualified for the selected service");
  const requiredResource = resolveBookableServiceResource(services, locationId);
  const requiredResources = requiredResource ? [requiredResource] : [];

  const candidateMinutes = new Map<number, ScheduleRecord>();
  for (const schedule of availability) {
    const range = interval(schedule);
    if (range.end <= range.start) continue;
    for (let minutes = range.start; minutes + serviceDuration <= range.end; minutes += slotStepMinutes) {
      if (!candidateMinutes.has(minutes)) candidateMinutes.set(minutes, schedule);
    }
  }

  const slots: AvailabilitySlot[] = [];
  for (const [slotStart, schedule] of [...candidateMinutes.entries()].sort(([a], [b]) => a - b)) {
    const serviceEnd = slotStart + serviceDuration;
    let instant: number;
    try { instant = zonedDateTimeToUtc(dateKey, slotStart, timezone).getTime(); } catch { continue; }
    if (instant <= Date.now() || instant > Date.now() + 366 * 86400_000) continue;
    if (!withinLocationHours(hours, requestedWeekday, slotStart, serviceEnd)) continue;
    const instantEnd = instant + (serviceDuration + BOOKING_BUFFER_MINUTES) * 60_000;
    const reservedEnd = serviceEnd + BOOKING_BUFFER_MINUTES;
    const breakStart = schedule.breakStart ? timeToMinutes(schedule.breakStart) : null;
    const breakEnd = schedule.breakEnd ? timeToMinutes(schedule.breakEnd) : null;
    const duringBreak = breakStart !== null && breakEnd !== null && overlap(slotStart, reservedEnd, breakStart, breakEnd);
    const blockedSchedule = blocks.find((block) => {
      const range = interval(block);
      return overlap(slotStart, reservedEnd, range.start, range.end);
    });
    const appointmentConflict = appointments.some((appointment: any) => {
      if (appointment.segments?.length) return false;
      const appointmentStart = new Date(appointment.startTime).getTime();
      return overlap(instant, instantEnd, appointmentStart, appointmentStart + (Number(appointment.duration || serviceDuration) + BOOKING_BUFFER_MINUTES) * 60_000);
    }) || segments.some((segment: any) => segment.practitioner?.id === stylistId && overlap(instant, instantEnd, new Date(segment.plannedStart).getTime(), new Date(segment.plannedEnd).getTime() + BOOKING_BUFFER_MINUTES * 60_000));

    let selectedResource: any = null;
    if (requiredResources.length) {
      selectedResource = requiredResources.find((resource: any) => {
        return resourceCapacityAvailable({
          resourceId: resource.id,
          capacity: Number(resource.capacity || 1),
          start: new Date(instant),
          end: new Date(instant + serviceDuration * 60_000),
          appointments: resourceAppointments as any,
          segments: segments as any,
        });
      }) || null;
    }
    const resourceBlocked = requiredResources.length > 0 && !selectedResource;
    const blockedReason = (blockedSchedule ? "Stylist unavailable" : null)
      || (duringBreak ? "Break time" : null)
      || (appointmentConflict ? "Selected stylist already has an appointment at that time" : null)
      || (resourceBlocked ? "Required room or equipment is unavailable at that time" : null);
    slots.push({
      time: timeLabel(slotStart),
      startTime: zonedDateTimeToUtc(dateKey, slotStart, timezone).toISOString(),
      available: !blockedReason,
      resourceId: selectedResource?.id || null,
      resourceName: selectedResource?.name || null,
      blockedReason,
    });
  }

  return {
    stylistId,
    stylistName: stylist.user?.name || "Salon provider",
    date: dateKey,
    timezone,
    locationId,
    slots,
  };
}
