import { createHash } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { serializableWorkflow } from "./serializableWorkflow";
import { computeStylistAvailability, getRuntimeLocation, isLocationOpenForInterval, zonedDateKey } from "../scheduling/availability";
import { BOOKING_BUFFER_MINUTES, isResourceAllocationAvailable, scheduleIntervalsOverlapWithBuffer } from "../scheduling/occupancy";
import { missingRequiredServiceResourceIds } from "../scheduling/resource-requirements";
import { isServiceSegmentEffectiveForInterval } from "../scheduling/service-segment-window";

type AllocationInput = {
  lineItemId: string;
  definitionId?: string | null;
  stableKey: string;
  sequence: number;
  parallelGroup?: string | null;
  type: "service" | "processing" | "finishing" | "cleanup";
  startOffsetMinutes: number;
  durationMinutes: number;
  practitionerRequired: boolean;
  practitionerId?: string | null;
  resourceId?: string | null;
  resourceUnits: number;
};

type ScheduleResult = { success: boolean; appointmentId: string | null; revision: number | null; error: string | null };
const ACTIVE_SEGMENT_STATUSES = ["planned", "started"];

function domainQuery(context: Context) { return (context.sudo().query as any); }
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function validKey(value: string) { return value.trim().length >= 12 && value.length <= 200; }
function assertEffectiveReschedulePolicy(snapshot: any) {
  const now = Date.now();
  if (!snapshot?.version || !snapshot?.acceptedAt || !Number.isFinite(Date.parse(snapshot.effectiveFrom)) || !Number.isFinite(Date.parse(snapshot.rescheduleDeadline))) throw new Error("Online rescheduling requires an accepted effective policy snapshot");
  if (snapshot.revokedAt) throw new Error("Online rescheduling policy has been revoked; contact the salon");
  if (new Date(snapshot.effectiveFrom).getTime() > now || (snapshot.effectiveUntil && new Date(snapshot.effectiveUntil).getTime() <= now)) throw new Error("Online rescheduling policy is not currently effective; contact the salon");
  if (!snapshot.rescheduleDeadline || new Date(snapshot.rescheduleDeadline).getTime() <= now) throw new Error("Online rescheduling is outside the accepted policy window; contact the salon");
}

function parseAllocations(value: unknown): AllocationInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new Error("Choose between 1 and 100 schedule segments");
  return value.map((raw: any, index) => {
    const item: AllocationInput = {
      lineItemId: String(raw?.lineItemId || ""), definitionId: raw?.definitionId ? String(raw.definitionId) : null,
      stableKey: String(raw?.stableKey || `segment-${index + 1}`), sequence: Number(raw?.sequence),
      parallelGroup: raw?.parallelGroup ? String(raw.parallelGroup) : null, type: raw?.type,
      startOffsetMinutes: Number(raw?.startOffsetMinutes), durationMinutes: Number(raw?.durationMinutes),
      practitionerRequired: raw?.practitionerRequired !== false,
      practitionerId: raw?.practitionerId ? String(raw.practitionerId) : null,
      resourceId: raw?.resourceId ? String(raw.resourceId) : null, resourceUnits: Number(raw?.resourceUnits ?? (raw?.resourceId ? 1 : 0)),
    };
    if (!item.lineItemId || !item.stableKey || item.stableKey.length > 120) throw new Error("Every segment requires a line item and stable key");
    if (!Number.isInteger(item.sequence) || item.sequence < 0 || !Number.isInteger(item.startOffsetMinutes) || item.startOffsetMinutes < 0
      || !Number.isInteger(item.durationMinutes) || item.durationMinutes <= 0 || item.durationMinutes > 24 * 60
      || !Number.isInteger(item.resourceUnits) || item.resourceUnits < 0 || item.resourceUnits > 100
      || !new Set(["service", "processing", "finishing", "cleanup"]).has(item.type)) throw new Error("Segment timing or type is invalid");
    if (item.practitionerRequired && !item.practitionerId) throw new Error("A required practitioner must be assigned");
    if (item.resourceUnits > 0 && !item.resourceId) throw new Error("Resource units require an assigned resource");
    return item;
  });
}

function allocationsFromAppointment(appointment: any): AllocationInput[] {
  return appointment.segments?.length ? appointment.segments.map((segment: any) => ({
    lineItemId: segment.lineItem.id, definitionId: segment.definition?.id || null, stableKey: segment.stableKey,
    sequence: segment.sequence, parallelGroup: segment.parallelGroup, type: segment.type,
    startOffsetMinutes: Math.round((Date.parse(segment.plannedStart) - Date.parse(appointment.startTime)) / 60_000),
    durationMinutes: segment.durationMinutes, practitionerRequired: segment.practitionerRequired,
    practitionerId: segment.practitioner?.id || null, resourceId: segment.resource?.id || null, resourceUnits: segment.resourceUnits,
  })) : appointment.lineItems.map((line: any, index: number) => ({
    lineItemId: line.id, stableKey: `service-${index + 1}`, sequence: index, type: "service" as const,
    startOffsetMinutes: appointment.lineItems.slice(0, index).reduce((sum: number, prior: any) => sum + prior.duration, 0),
    durationMinutes: line.duration, practitionerRequired: true, practitionerId: appointment.stylist?.id,
    resourceId: appointment.resource?.id, resourceUnits: appointment.resource?.id ? 1 : 0,
  }));
}

function assignmentLockKeys(items: AllocationInput[]) {
  return items.flatMap(item => [
    item.practitionerId && `practitioner:${item.practitionerId}`,
    item.resourceId && `resource:${item.resourceId}`,
  ]).filter(Boolean) as string[];
}

function validateSequence(items: AllocationInput[]) {
  const keys = new Set<string>();
  for (const item of items) {
    if (keys.has(item.stableKey)) throw new Error("Segment stable keys must be unique within a revision");
    keys.add(item.stableKey);
  }
  for (const lineItemId of new Set(items.map(item => item.lineItemId))) {
    const line = items.filter(item => item.lineItemId === lineItemId).sort((a, b) => a.sequence - b.sequence);
    for (let index = 1; index < line.length; index += 1) {
      const prior = line[index - 1]; const current = line[index];
      if (current.sequence <= prior.sequence) throw new Error("Segment sequence must be strictly increasing per service line");
      if (current.startOffsetMinutes < prior.startOffsetMinutes + prior.durationMinutes) throw new Error("Segments on one service line cannot overlap");
    }
  }
  for (let left = 0; left < items.length; left += 1) for (let right = left + 1; right < items.length; right += 1) {
    const a = items[left]; const b = items[right];
    const overlaps = a.startOffsetMinutes < b.startOffsetMinutes + b.durationMinutes && b.startOffsetMinutes < a.startOffsetMinutes + a.durationMinutes;
    if (scheduleIntervalsOverlapWithBuffer(
      a.startOffsetMinutes * 60_000, (a.startOffsetMinutes + a.durationMinutes) * 60_000,
      b.startOffsetMinutes * 60_000, (b.startOffsetMinutes + b.durationMinutes) * 60_000,
    ) && a.practitionerId && a.practitionerId === b.practitionerId) throw new Error("One practitioner cannot be allocated to overlapping or back-to-back segments without a buffer");
    if (overlaps && a.lineItemId !== b.lineItemId && (!a.parallelGroup || a.parallelGroup !== b.parallelGroup)) {
      throw new Error("Parallel service segments must share an explicit parallel group");
    }
    if (overlaps && a.practitionerId && a.practitionerId === b.practitionerId) throw new Error("One practitioner cannot perform parallel segments");
  }
}

async function assertAssignments(sudo: any, appointment: any, items: AllocationInput[], start: Date, location: { locationId: string; timezone: string; hours: unknown }) {
  const appointmentEnd = new Date(start.getTime() + Math.max(...items.map(item => item.startOffsetMinutes + item.durationMinutes)) * 60_000);
  if (!isLocationOpenForInterval(location.hours, location.timezone, start, appointmentEnd)) throw new Error("Requested appointment is outside salon opening hours");
  const lineMap = new Map(appointment.lineItems.map((line: any) => [line.id, line]));
  const definitionIds = items.map(item => item.definitionId).filter(Boolean) as string[];
  const definitions = definitionIds.length ? await sudo.query.ServiceSegment.findMany({
    where: { id: { in: definitionIds } }, take: 100,
    query: "id stableKey sequence parallelGroup type durationMinutes practitionerRequired resourceUnits effectiveFrom effectiveUntil service { id } qualifiedPractitioners { id } eligibleResources { id }",
  }) : [];
  const definitionMap = new Map(definitions.map((item: any) => [item.id, item]));
  if (appointment.lineItems.some((line: any) => !items.some(item => item.lineItemId === line.id))) throw new Error("Every booked service line must be included");
  for (const line of appointment.lineItems) {
    const assignedResourceIds = items.filter(item => item.lineItemId === line.id).flatMap(item => item.resourceId ? [item.resourceId] : []);
    if (missingRequiredServiceResourceIds(line.service?.requiredResources || [], assignedResourceIds).length) {
      throw new Error("Every required service resource must be assigned to the booked service plan");
    }
  }
  for (const item of items) {
    const line: any = lineMap.get(item.lineItemId);
    if (!line) throw new Error("A segment does not belong to this appointment");
    const segmentStart = new Date(start.getTime() + item.startOffsetMinutes * 60_000);
    const segmentEnd = new Date(segmentStart.getTime() + item.durationMinutes * 60_000);
    const definition: any = item.definitionId ? definitionMap.get(item.definitionId) : null;
    if (item.definitionId && !definition) throw new Error("Segment definition was not found");
    if (definition) {
      if (definition.service?.id !== line.service?.id || definition.stableKey !== item.stableKey || definition.sequence !== item.sequence
        || definition.type !== item.type || definition.durationMinutes !== item.durationMinutes || definition.practitionerRequired !== item.practitionerRequired
        || Number(definition.resourceUnits || 0) !== item.resourceUnits) throw new Error("Allocation does not match its effective service-segment version");
      if (!isServiceSegmentEffectiveForInterval(definition, segmentStart, segmentEnd)) throw new Error("Segment definition is not effective for the full scheduled interval");
      if (item.practitionerId && !definition.qualifiedPractitioners.some((person: any) => person.id === item.practitionerId)) throw new Error("Practitioner is not qualified for this segment");
      if (item.resourceId && !definition.eligibleResources.some((resource: any) => resource.id === item.resourceId)) throw new Error("Resource is not eligible for this segment");
    } else {
      if (item.type !== "service" || item.durationMinutes !== line.duration || !item.practitionerRequired || items.filter(other => other.lineItemId === item.lineItemId).length !== 1) throw new Error("Unversioned allocations must preserve the booked service duration and practitioner requirement");
      if (line.service?.requiredResources?.length && !item.resourceId) throw new Error("The booked service requires a resource");
      if (item.practitionerId && !line.service?.specialists?.some((person: any) => person.id === item.practitionerId)) throw new Error("Practitioner is not qualified for this service");
      if (item.resourceId && !line.service?.requiredResources?.some((resource: any) => resource.id === item.resourceId)) throw new Error("Resource is not eligible for this service");
    }
    if (item.resourceId) {
      const resource = await sudo.query.SalonResource.findOne({ where: { id: item.resourceId }, query: "id isActive location { id }" });
      if (!resource?.isActive || resource.location?.id !== location.locationId) throw new Error("Resource is not available at the appointment location");
    }
    if (item.practitionerId) {
      const availability = await computeStylistAvailability({ sudo, stylistId: item.practitionerId, date: zonedDateKey(segmentStart, location.timezone), serviceDuration: item.durationMinutes, serviceIds: [line.service.id], locationId: location.locationId, excludeAppointmentId: appointment.id, slotStepMinutes: 1 });
      if (!availability.slots.some(slot => slot.available && Date.parse(slot.startTime) === segmentStart.getTime())) throw new Error("Requested segment is outside available hours or capacity");
    }
  }
}

async function assertCapacity(sudo: any, appointmentId: string, locationId: string, start: Date, items: AllocationInput[]) {
  for (const item of items) {
    const plannedStart = new Date(start.getTime() + item.startOffsetMinutes * 60_000);
    const plannedEnd = new Date(plannedStart.getTime() + item.durationMinutes * 60_000);
    const overlaps = item.practitionerId ? await sudo.query.AppointmentSegment.findMany({
      where: {
        NOT: { appointment: { id: { equals: appointmentId } } }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] } }, status: { in: ACTIVE_SEGMENT_STATUSES },
        plannedStart: { lt: new Date(plannedEnd.getTime() + BOOKING_BUFFER_MINUTES * 60_000).toISOString() },
        plannedEnd: { gt: new Date(plannedStart.getTime() - BOOKING_BUFFER_MINUTES * 60_000).toISOString() },
        practitioner: { id: { equals: item.practitionerId } },
      }, take: 200, query: "id practitioner { id }",
    }) : [];
    if (item.practitionerId && overlaps.some((segment: any) => segment.practitioner?.id === item.practitionerId)) throw new Error("Assigned practitioner is already allocated during this segment");
    if (item.resourceId) {
      const requestedParallelUnits = items.filter(other => other !== item && other.resourceId === item.resourceId
        && scheduleIntervalsOverlapWithBuffer(
          item.startOffsetMinutes * 60_000,
          (item.startOffsetMinutes + item.durationMinutes) * 60_000,
          other.startOffsetMinutes * 60_000,
          (other.startOffsetMinutes + other.durationMinutes) * 60_000,
        ))
        .reduce((sum, other) => sum + other.resourceUnits, 0);
      const available = await isResourceAllocationAvailable(sudo, {
        resourceId: item.resourceId,
        locationId,
        start: plannedStart,
        end: plannedEnd,
        requestedUnits: item.resourceUnits + requestedParallelUnits,
        excludeAppointmentId: appointmentId,
      });
      if (!available) throw new Error("Assigned resource capacity is unavailable during this segment");
    }
  }
}

export async function scheduleAppointmentSegmentsTransaction(context: Context, args: {
  appointmentId: string; startTime: string; allocations?: unknown; reason: string; idempotencyKey: string;
}): Promise<ScheduleResult> {
  if (!context.session?.itemId) return { success: false, appointmentId: null, revision: null, error: "You must be signed in" };
  if (!validKey(args.idempotencyKey)) return { success: false, appointmentId: null, revision: null, error: "Schedule idempotency key is invalid" };
  const operator = permissions.canManageAppointments({ session: context.session as any });
  let items: AllocationInput[] = []; const start = new Date(args.startTime); const reason = args.reason.trim();
  try { if (operator && args.allocations != null) { items = parseAllocations(args.allocations); validateSequence(items); } } catch (error) { return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Schedule is invalid" }; }
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now() || start.getTime() > Date.now() + 366 * 86400_000 || !reason || reason.length > 1000) return { success: false, appointmentId: null, revision: null, error: "A valid start and reason are required" };
  let requestedScheduleHash = digest(items);
  let ownerPlanSnapshotHash: string | null = null;
  let ownerPlanLockKeys: string[] = [];
  if (!operator || args.allocations == null) {
    try {
      const ownerSnapshot = await context.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id startTime client { user { id } } stylist { id } resource { id } lineItems { id duration } segments(where: { status: { in: [planned, started] } }) { lineItem { id } definition { id } stableKey sequence parallelGroup type plannedStart durationMinutes practitionerRequired practitioner { id } resource { id } resourceUnits }",
      });
      if (ownerSnapshot && (operator || ownerSnapshot.client?.user?.id === context.session!.itemId)) {
        const ownerItems = parseAllocations(allocationsFromAppointment(ownerSnapshot));
        validateSequence(ownerItems);
        ownerPlanSnapshotHash = digest(ownerItems);
        ownerPlanLockKeys = assignmentLockKeys(ownerItems);
        if (operator) { items = ownerItems; requestedScheduleHash = digest(items); }
      }
    } catch (error) {
      return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Appointment plan could not be verified" };
    }
  }

  try {
    return await serializableWorkflow(context, "salon-segment-schedule", [
      `appointment:${args.appointmentId}`, `idempotency:${args.idempotencyKey}`,
      ...assignmentLockKeys(items), ...ownerPlanLockKeys,
    ], async transactionContext => {
      const visible = await transactionContext.query.Appointment.findOne({ where: { id: args.appointmentId }, query: "id client { user { id } }" });
      if (!visible || (!operator && visible.client?.user?.id !== context.session!.itemId)) throw new Error("You cannot schedule this appointment");
      const sudo = transactionContext.sudo(); const domain = domainQuery(transactionContext);
      const existing = (await domain.AppointmentScheduleRevision.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id revision nextStart reason scheduleHash appointment { id }" }))[0];
      const appointment = await sudo.query.Appointment.findOne({
        where: { id: args.appointmentId },
        query: "id status startTime endTime metadata location { id } stylist { id } resource { id } client { user { id } } lineItems { id duration service { id specialists { id } requiredResources { id } } } segments(where: { status: { in: [planned, started] } }) { lineItem { id } definition { id } stableKey sequence parallelGroup type plannedStart durationMinutes practitionerRequired practitioner { id } resource { id } resourceUnits }",
      });
      if (!appointment || ["completed", "cancelled", "no_show"].includes(appointment.status || "")) throw new Error("Appointment is not schedulable");
      const owner = appointment.client?.user?.id === context.session!.itemId;
      if (!operator && !owner) throw new Error("You cannot schedule this appointment");
      if (!operator || args.allocations == null) {
        const metadata = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata as Record<string, any> : {};
        if (!operator) assertEffectiveReschedulePolicy(metadata.clientPolicySnapshot);
        // The browser chooses only a time. It never defines service duration,
        // coverage, required practitioner or resource occupancy.
        items = parseAllocations(allocationsFromAppointment(appointment));
        validateSequence(items);
        requestedScheduleHash = digest(items);
        if (!ownerPlanSnapshotHash || requestedScheduleHash !== ownerPlanSnapshotHash) throw new Error("The appointment plan changed; reload before rescheduling");
      }
      if (existing) {
        if (existing.appointment?.id !== args.appointmentId || new Date(existing.nextStart).getTime() !== start.getTime() || existing.reason !== reason || existing.scheduleHash !== requestedScheduleHash) throw new Error("Schedule idempotency key was reused for different evidence");
        return { success: true, appointmentId: args.appointmentId, revision: existing.revision, error: null };
      }
      const location = await getRuntimeLocation(sudo, appointment.location?.id);
      await assertAssignments(sudo, appointment, items, start, location);
      await assertCapacity(sudo, appointment.id, location.locationId, start, items);
      const previous = await domain.AppointmentSegment.findMany({ where: { appointment: { id: { equals: appointment.id } }, status: { in: ACTIVE_SEGMENT_STATUSES } }, take: 200, query: "id status" });
      const revisions = await domain.AppointmentScheduleRevision.findMany({ where: { appointment: { id: { equals: appointment.id } } }, take: 200, query: "id revision" });
      const revisionNumber = Math.max(0, ...revisions.map((item: any) => Number(item.revision || 0))) + 1;
      const endOffset = Math.max(...items.map(item => item.startOffsetMinutes + item.durationMinutes));
      const end = new Date(start.getTime() + endOffset * 60_000); const now = new Date().toISOString(); const scheduleHash = requestedScheduleHash;
      const revision = await domain.AppointmentScheduleRevision.createOne({ data: {
        appointment: { connect: { id: appointment.id } }, revision: revisionNumber, priorStart: appointment.startTime || undefined, priorEnd: appointment.endTime || undefined,
        nextStart: start.toISOString(), nextEnd: end.toISOString(), reason, actor: { connect: { id: context.session!.itemId } },
        actorAuthority: operator ? "appointment_operator" : "client_owner", scheduleHash, idempotencyKey: args.idempotencyKey,
        evidence: { segmentCount: items.length, priorActiveSegmentIds: previous.map((item: any) => item.id) },
      }, query: "id" });
      for (const segment of previous) {
        await domain.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: "superseded" }, query: "id" });
        await domain.SegmentTransition.createOne({ data: { segment: { connect: { id: segment.id } }, fromStatus: segment.status, toStatus: "superseded", reason, actor: { connect: { id: context.session!.itemId } }, occurredAt: now, idempotencyKey: `${args.idempotencyKey}:supersede:${segment.id}`, evidence: { scheduleRevision: revisionNumber } }, query: "id" });
      }
      for (const item of items) {
        const plannedStart = new Date(start.getTime() + item.startOffsetMinutes * 60_000); const plannedEnd = new Date(plannedStart.getTime() + item.durationMinutes * 60_000);
        await domain.AppointmentSegment.createOne({ data: {
          appointment: { connect: { id: appointment.id } }, lineItem: { connect: { id: item.lineItemId } }, definition: item.definitionId ? { connect: { id: item.definitionId } } : undefined,
          revision: { connect: { id: revision.id } }, stableKey: item.stableKey, sequence: item.sequence, parallelGroup: item.parallelGroup || "", type: item.type,
          plannedStart: plannedStart.toISOString(), plannedEnd: plannedEnd.toISOString(), durationMinutes: item.durationMinutes, practitionerRequired: item.practitionerRequired,
          practitioner: item.practitionerId ? { connect: { id: item.practitionerId } } : undefined, resource: item.resourceId ? { connect: { id: item.resourceId } } : undefined,
          resourceUnits: item.resourceUnits, status: "planned", idempotencyKey: `${args.idempotencyKey}:segment:${item.stableKey}`,
          assignmentEvidence: { definitionId: item.definitionId || null, scheduleHash, qualifiedAt: now },
        }, query: "id" });
      }
      const metadata = appointment.metadata as any;
      const policy = metadata?.clientPolicySnapshot;
      await sudo.query.Appointment.updateOne({ where: { id: appointment.id }, data: { startTime: start.toISOString(), endTime: end.toISOString(), duration: endOffset,
        stylist: items[0]?.practitionerId ? { connect: { id: items[0].practitionerId } } : { disconnect: true }, resource: items[0]?.resourceId ? { connect: { id: items[0].resourceId } } : { disconnect: true },
        ...(policy?.acceptedAt ? { metadata: { ...metadata, clientPolicySnapshot: { ...policy, cancellationDeadline: new Date(start.getTime() - Number(policy.cancellationNoticeMinutes) * 60_000).toISOString(), rescheduleDeadline: new Date(start.getTime() - Number(policy.rescheduleNoticeMinutes) * 60_000).toISOString() } } } : {}),
      }, query: "id" });
      return { success: true, appointmentId: appointment.id, revision: revisionNumber, error: null };
    });
  } catch (error) { return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Scheduling failed" }; }
}

const resultType = graphql.object<ScheduleResult>()({ name: "SegmentScheduleResult", fields: {
  success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), appointmentId: graphql.field({ type: graphql.ID }), revision: graphql.field({ type: graphql.Int }), error: graphql.field({ type: graphql.String }),
} });

export const scheduleAppointmentSegments = graphql.field({
  type: resultType,
  args: { appointmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), startTime: graphql.arg({ type: graphql.nonNull(graphql.String) }), allocations: graphql.arg({ type: graphql.JSON }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve(_source, args, context: Context) { return scheduleAppointmentSegmentsTransaction(context, args); },
});

export async function transitionAppointmentSegmentTransaction(context: Context, args: { segmentId: string; status: string; reason: string; idempotencyKey: string }): Promise<ScheduleResult> {
  if (!permissions.canManageAppointments({ session: context.session as any }) || !validKey(args.idempotencyKey)) return { success: false, appointmentId: null, revision: null, error: "Appointment authority and a valid idempotency key are required" };
  const transitions: Record<string, string[]> = { planned: ["started", "skipped"], started: ["completed", "skipped"] };
  try {
    return await serializableWorkflow(context, "salon-segment-transition", [`segment:${args.segmentId}`, `idempotency:${args.idempotencyKey}`], async tx => {
      const domain = domainQuery(tx); const existing = (await domain.SegmentTransition.findMany({ where: { idempotencyKey: { equals: args.idempotencyKey } }, take: 1, query: "id toStatus reason segment { id appointment { id } }" }))[0];
      if (existing) {
        if (existing.segment?.id !== args.segmentId || existing.toStatus !== args.status || existing.reason !== args.reason.trim()) throw new Error("Segment transition idempotency key was reused for another transition");
        return { success: true, appointmentId: existing.segment?.appointment?.id || null, revision: null, error: null };
      }
      const segment = await domain.AppointmentSegment.findOne({ where: { id: args.segmentId }, query: "id status appointment { id }" });
      if (!segment || !(transitions[segment.status] || []).includes(args.status)) throw new Error("Invalid segment transition");
      await domain.AppointmentSegment.updateOne({ where: { id: segment.id }, data: { status: args.status }, query: "id" });
      await domain.SegmentTransition.createOne({ data: { segment: { connect: { id: segment.id } }, fromStatus: segment.status, toStatus: args.status, reason: args.reason.trim(), actor: { connect: { id: context.session!.itemId } }, occurredAt: new Date().toISOString(), idempotencyKey: args.idempotencyKey, evidence: { controlledWorkflow: true } }, query: "id" });
      return { success: true, appointmentId: segment.appointment?.id || null, revision: null, error: null };
    });
  } catch (error) { return { success: false, appointmentId: null, revision: null, error: error instanceof Error ? error.message : "Segment transition failed" }; }
}

export const transitionAppointmentSegment = graphql.field({
  type: resultType,
  args: { segmentId: graphql.arg({ type: graphql.nonNull(graphql.ID) }), status: graphql.arg({ type: graphql.nonNull(graphql.String) }), reason: graphql.arg({ type: graphql.nonNull(graphql.String) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  resolve(_source, args, context: Context) { return transitionAppointmentSegmentTransaction(context, args); },
});
