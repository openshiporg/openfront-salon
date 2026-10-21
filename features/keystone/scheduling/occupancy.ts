import type { Context } from ".keystone/types";

export const BOOKING_BUFFER_MINUTES = 15;
const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"] as const;
const ACTIVE_SEGMENT_STATUSES = ["planned", "started"] as const;
const MINUTE_MS = 60_000;

type ResourceAppointment = {
  startTime: string;
  endTime?: string | null;
  duration?: number | null;
  resource?: { id?: string | null } | null;
  segments?: Array<unknown> | null;
};

type ResourceSegment = {
  plannedStart: string;
  plannedEnd: string;
  resourceUnits?: number | null;
  resource?: { id?: string | null } | null;
};

export function scheduleIntervalsOverlapWithBuffer(startA: number, endA: number, startB: number, endB: number, bufferMinutes = BOOKING_BUFFER_MINUTES) {
  const bufferMs = bufferMinutes * MINUTE_MS;
  return startA < endB + bufferMs && startB < endA + bufferMs;
}

function validInterval(start: Date, end: Date) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
    throw new Error("Resource schedule interval is invalid");
  }
}

/**
 * Count resource units that overlap a proposed allocation. Parent appointments
 * are authoritative only for legacy appointments without active segment plans;
 * once a plan exists, its active segments are the sole occupancy records.
 */
export function countResourceOccupancyUnits({
  resourceId,
  start,
  end,
  appointments,
  segments,
  bufferMinutes = BOOKING_BUFFER_MINUTES,
}: {
  resourceId: string;
  start: Date;
  end: Date;
  appointments: ResourceAppointment[];
  segments: ResourceSegment[];
  bufferMinutes?: number;
}) {
  validInterval(start, end);
  const candidateStart = start.getTime();
  const candidateEnd = end.getTime();
  let occupiedUnits = 0;

  for (const appointment of appointments) {
    if (appointment.resource?.id !== resourceId || appointment.segments?.length) continue;
    const appointmentStart = Date.parse(appointment.startTime);
    const persistedEnd = appointment.endTime ? Date.parse(appointment.endTime) : Number.NaN;
    const duration = Number(appointment.duration);
    const appointmentEnd = Number.isFinite(persistedEnd)
      ? persistedEnd
      : appointmentStart + (Number.isFinite(duration) && duration > 0 ? duration : 0) * MINUTE_MS;
    if (!Number.isFinite(appointmentStart) || !Number.isFinite(appointmentEnd) || appointmentEnd <= appointmentStart) {
      throw new Error("Resource appointment occupancy evidence is invalid");
    }
    if (scheduleIntervalsOverlapWithBuffer(candidateStart, candidateEnd, appointmentStart, appointmentEnd, bufferMinutes)) occupiedUnits += 1;
  }

  for (const segment of segments) {
    if (segment.resource?.id !== resourceId) continue;
    const segmentStart = Date.parse(segment.plannedStart);
    const segmentEnd = Date.parse(segment.plannedEnd);
    const units = Number(segment.resourceUnits ?? 1);
    if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd) || segmentEnd <= segmentStart
      || !Number.isInteger(units) || units < 1) {
      throw new Error("Resource segment occupancy evidence is invalid");
    }
    if (scheduleIntervalsOverlapWithBuffer(candidateStart, candidateEnd, segmentStart, segmentEnd, bufferMinutes)) occupiedUnits += units;
  }

  return occupiedUnits;
}

export function resourceCapacityAvailable({
  resourceId,
  capacity,
  start,
  end,
  appointments,
  segments,
  requestedUnits = 1,
}: {
  resourceId: string;
  capacity: number;
  start: Date;
  end: Date;
  appointments: ResourceAppointment[];
  segments: ResourceSegment[];
  requestedUnits?: number;
}) {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(requestedUnits) || requestedUnits < 1) {
    throw new Error("Resource capacity evidence is invalid");
  }
  return countResourceOccupancyUnits({ resourceId, start, end, appointments, segments }) + requestedUnits <= capacity;
}

export async function isResourceAllocationAvailable(
  sudo: ReturnType<Context["sudo"]>,
  {
    resourceId,
    locationId,
    start,
    end,
    requestedUnits = 1,
    excludeAppointmentId,
  }: {
    resourceId: string;
    locationId: string;
    start: Date;
    end: Date;
    requestedUnits?: number;
    excludeAppointmentId?: string;
  },
) {
  validInterval(start, end);
  const resource = await sudo.query.SalonResource.findOne({
    where: { id: resourceId },
    query: "id capacity isActive location { id }",
  });
  if (!resource || !resource.isActive || resource.location?.id !== locationId) {
    throw new Error("Resource is not available at the appointment location");
  }
  const capacity = Number(resource.capacity || 1);
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(requestedUnits) || requestedUnits < 1) {
    throw new Error("Resource capacity evidence is invalid");
  }

  const bufferMs = BOOKING_BUFFER_MINUTES * MINUTE_MS;
  const windowStart = new Date(start.getTime() - bufferMs).toISOString();
  const windowEnd = new Date(end.getTime() + bufferMs).toISOString();
  const appointmentWhere = {
    resource: { id: { equals: resourceId } },
    startTime: { lt: windowEnd },
    OR: [{ endTime: { gt: windowStart } }, { endTime: null }],
    status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    ...(excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}),
  };
  const appointments = await sudo.query.Appointment.findMany({
    where: appointmentWhere,
    take: 2000,
    query: "id startTime endTime duration resource { id } segments(where: { status: { in: [planned, started] } }) { id }",
  }) as ResourceAppointment[];
  const segments = await (sudo.query as any).AppointmentSegment.findMany({
    where: {
      resource: { id: { equals: resourceId } },
      appointment: {
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        ...(excludeAppointmentId ? { NOT: { id: { equals: excludeAppointmentId } } } : {}),
      },
      status: { in: [...ACTIVE_SEGMENT_STATUSES] },
      plannedStart: { lt: windowEnd },
      plannedEnd: { gt: windowStart },
    },
    take: 5000,
    query: "id plannedStart plannedEnd resourceUnits resource { id }",
  }) as ResourceSegment[];
  if (appointments.length >= 2000 || segments.length >= 5000) {
    throw new Error("Resource schedule is too large to safely evaluate; narrow the operating window");
  }

  return resourceCapacityAvailable({
    resourceId,
    capacity,
    start,
    end,
    appointments,
    segments,
    requestedUnits,
  });
}
