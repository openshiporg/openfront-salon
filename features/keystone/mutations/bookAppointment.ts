import { createHash, randomBytes } from "node:crypto";
import { graphql } from "@keystone-6/core";
import { assertCurrentWorkflowAuthority } from "./currentWorkflowAuthority";
import { acquireSalonCapacityFence } from "../scheduling/capacityFence";
import type { Context } from ".keystone/types";
import { sendAppointmentConfirmation } from "../lib/mail";
import { getStorefrontMessageBrand } from "../lib/storefrontBranding";
import { permissions, type Session } from "../access";
import { captureServiceSnapshot } from "../serviceSnapshot";
import { bookingPolicy, hasCurrentBookingPolicyAffirmation } from "../bookingPolicy";
import { isActiveServiceStatus } from "../serviceStatus";
import { BOOKING_OUTCOME_UNRESOLVED, BOOKING_REQUEST_KEY_CONFLICT, recoverBookingByIdempotency } from "../bookingRecovery";
import { computeStylistAvailability, getRuntimeLocation, zonedDateKey, type AvailabilitySlot } from "../scheduling/availability";

const CAPACITY_RECHECK_DELAYS_MS = [0, 50, 150] as const;
const STYLIST_OCCUPIED_REASON = "Selected stylist already has an appointment at that time";
const RESOURCE_UNAVAILABLE_REASON = "Required room or equipment is unavailable at that time";

const BookAppointmentResult = graphql.object<{
  success: boolean;
  appointmentId: string | null;
  error: string | null;
}>()({
  name: "BookAppointmentResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    appointmentId: graphql.field({ type: graphql.ID }),
    error: graphql.field({ type: graphql.String }),
  },
});

function servicePriceCents(service: any) {
  if (typeof service.price === "number") return service.price;
  return Number(service.basePrice || 0);
}

function guestPassword() {
  return randomBytes(32).toString("base64url");
}

/**
 * Public guests get a contact-only Client so the front desk sees them. It is
 * matched only against other account-less records, never a signed-in client.
 */
async function resolveGuestClient(
  sudo: ReturnType<Context["sudo"]>,
  input: { name: string; email: string; phone?: string | null },
): Promise<{ id: string; user: null }> {
  const existing = await sudo.query.Client.findMany({
    where: { user: null, guestEmail: { equals: input.email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    take: 1,
    query: "id",
  });
  if (existing[0]) {
    await sudo.query.Client.updateOne({
      where: { id: existing[0].id },
      data: { guestName: input.name, ...(input.phone ? { guestPhone: input.phone } : {}) },
      query: "id",
    });
    return { id: existing[0].id, user: null };
  }
  const created = await sudo.query.Client.createOne({
    data: { guestName: input.name, guestEmail: input.email, guestPhone: input.phone || "", firstVisit: new Date().toISOString(), totalVisits: 0, lifetimeValue: 0 },
    query: "id",
  });
  return { id: created.id, user: null };
}

async function resolveAuthorizedClient(
  sudo: ReturnType<Context["sudo"]>,
  input: { name: string; email: string; phone?: string | null },
  sessionUserId?: string,
  isOperator = false,
) {
  // Public requests remain guest bookings. They must never claim an existing
  // client identity merely by knowing an email address.
  if (!sessionUserId && !isOperator) return null;

  let user = sessionUserId
    ? await sudo.query.User.findOne({ where: { id: sessionUserId }, query: "id name email phone" })
    : await sudo.query.User.findOne({ where: { email: input.email }, query: "id name email phone" });

  if (sessionUserId && user?.email?.toLowerCase() !== input.email) {
    throw new Error("Use the email address on your signed-in account");
  }

  if (!user && isOperator) {
    // Front desk booking for a known guest keeps their existing account-less record.
    const guest = await sudo.query.Client.findMany({ where: { user: null, guestEmail: { equals: input.email, mode: "insensitive" } }, orderBy: { createdAt: "asc" }, take: 1, query: "id" });
    if (guest[0]) return { id: guest[0].id, user: null };
    user = await sudo.query.User.createOne({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || "",
        password: guestPassword(),
      },
      query: "id name email phone",
    });
  }
  if (!user) throw new Error("Signed-in client account could not be found");

  const existingClients = await sudo.query.Client.findMany({
    where: { user: { id: { equals: user.id } } },
    take: 1,
    query: "id user { id name email phone }",
  });
  if (existingClients[0]) return existingClients[0];

  return sudo.query.Client.createOne({
    data: {
      user: { connect: { id: user.id } },
      firstVisit: new Date().toISOString(),
      totalVisits: 0,
      lifetimeValue: 0,
    },
    query: "id user { id name email phone }",
  });
}

async function lockBookingCapacity(context: Context, stylistId: string, services: readonly any[]) {
  const keys = [
    `stylist:${stylistId}`,
    ...services.flatMap((service: any) => service.requiredResources || []).map((resource: any) => `resource:${resource.id}`),
  ];
  for (const key of [...new Set(keys)].sort()) {
    await context.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "salon-appointment-capacity",
      key,
    );
  }
}

/** A revoked operator's cookie must not reach privileged booking reads, writes or idempotent replay. */
class BookingOperatorDenied extends Error {}

/** Cookie role flags are not operator authority: re-read the actor's current role in this attempt's transaction. */
async function assertFreshBookingOperator(context: Context) {
  const denied = () => new BookingOperatorDenied("You must be an authorized salon operator");
  const itemId = context.session?.itemId;
  if (typeof itemId !== "string" || !itemId || context.session?.listKey !== "User") throw denied();
  const actor = await context.query.User.findOne({
    where: { id: itemId },
    query: "id role { id name canManageSalon canManageAppointments }",
  });
  if (!actor || actor.id !== itemId || !actor.role) throw denied();
  const session = { ...context.session, data: { ...context.session.data, role: actor.role } } as Session;
  if (!permissions.canManageAppointments({ session })) throw denied();
}

async function serializable<T>(context: Context, work: (transactionContext: Context) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.transaction(async tx => { await acquireSalonCapacityFence(tx); await assertCurrentWorkflowAuthority(tx); return work(tx); }, {
        maxWait: 5_000,
        timeout: 15_000,
        isolationLevel: "Serializable" as any,
      });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = error?.code === "P2034" || error?.code === "40001" || error?.meta?.code === "40001"
        || /write conflict|deadlock|please retry your transaction/i.test(message);
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to reserve appointment capacity");
}

async function loadServices(sudo: ReturnType<Context["sudo"]>, serviceIds: string[]) {
  const services = await sudo.query.Service.findMany({
    where: { id: { in: serviceIds } },
    query: `
      id
      name
      status
      baseDuration
      basePrice
      price
      depositAmount
      requiresConsultation
      requiresPatchTest
      image { imagePath image { url } }
      specialists { id }
      requiredResources {
        id
        name
        capacity
      }
    `,
  });

  if (services.length !== new Set(serviceIds).size) {
    throw new Error("One or more selected services could not be found");
  }

  const inactiveService = services.find((service: any) => !isActiveServiceStatus(service.status));
  if (inactiveService) {
    throw new Error(`${inactiveService.name || "Selected service"} is not currently bookable`);
  }
  return services;
}

function originalBookingError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to book appointment";
}

function opaqueAppointmentLifecycleError(error: unknown) {
  return /Appointment\.hooks\.afterOperation: appointment lifecycle event is missing its aggregate id/i.test(originalBookingError(error));
}

export function authoritativeBookingCapacityReason(slots: readonly AvailabilitySlot[], requestedStart: Date) {
  const exactSlot = slots.find((slot) => new Date(slot.startTime).getTime() === requestedStart.getTime());
  if (exactSlot?.available) return null;
  return exactSlot?.blockedReason === STYLIST_OCCUPIED_REASON || exactSlot?.blockedReason === RESOURCE_UNAVAILABLE_REASON
    ? exactSlot.blockedReason
    : null;
}

export function classifiedBookingError(error: unknown, capacityReason: string | null) {
  if (!opaqueAppointmentLifecycleError(error)) return originalBookingError(error);
  return capacityReason === STYLIST_OCCUPIED_REASON || capacityReason === RESOURCE_UNAVAILABLE_REASON
    ? capacityReason
    : originalBookingError(error);
}

/** Re-read capacity outside a failed transaction. This path never writes. */
export async function recheckFailedBookingCapacity(
  context: Context,
  request: { serviceIds: string[]; stylistId: string; locationId?: string | null; start: Date },
  delaysMs: readonly number[] = CAPACITY_RECHECK_DELAYS_MS,
): Promise<string | null> {
  for (const delayMs of delaysMs.slice(0, CAPACITY_RECHECK_DELAYS_MS.length)) {
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 250)));
    try {
      const sudo = context.sudo();
      const services = await loadServices(sudo, request.serviceIds);
      const duration = services.reduce((sum: number, service: any) => sum + Number(service.baseDuration || 0), 0) || 60;
      const location = await getRuntimeLocation(sudo, request.locationId);
      const availability = await computeStylistAvailability({
        sudo,
        stylistId: request.stylistId,
        date: zonedDateKey(request.start, location.timezone),
        serviceDuration: duration,
        serviceIds: request.serviceIds,
        locationId: location.locationId,
      });
      const blockedReason = authoritativeBookingCapacityReason(availability.slots, request.start);
      if (blockedReason) return blockedReason;
      const exactSlot = availability.slots.find((slot) => new Date(slot.startTime).getTime() === request.start.getTime());
      if (!exactSlot?.available) return null;
    } catch {
      return null;
    }
  }
  return null;
}

export const bookAppointment = graphql.field({
  type: BookAppointmentResult,
  args: {
    serviceIds: graphql.arg({ type: graphql.nonNull(graphql.list(graphql.nonNull(graphql.ID))) }),
    stylistId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    locationId: graphql.arg({ type: graphql.ID }),
    startTime: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    clientName: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    clientEmail: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    clientPhone: graphql.arg({ type: graphql.String }),
    clientNotes: graphql.arg({ type: graphql.String }),
    policyAccepted: graphql.arg({ type: graphql.Boolean }),
    policyVersion: graphql.arg({ type: graphql.String }),
    requestKey: graphql.arg({ type: graphql.String }),
  },
  async resolve(source, args, context: Context) {
    const serviceIds = Array.from(new Set(args.serviceIds.filter(Boolean)));
    const clientName = args.clientName.trim();
    const clientEmail = args.clientEmail.trim().toLowerCase();
    const clientPhone = args.clientPhone?.trim() || "";
    const start = new Date(args.startTime);
    const isOperator = permissions.canManageAppointments({ session: context.session as any });
    const policy = bookingPolicy();
    if (!isOperator && !hasCurrentBookingPolicyAffirmation(args.policyAccepted, args.policyVersion, policy.version)) return { success: false, appointmentId: null, error: "Read and accept the current booking policy before reserving" };
    if (args.requestKey && (args.requestKey.length < 12 || args.requestKey.length > 160)) return { success: false, appointmentId: null, error: "Booking request key is invalid" };
    const requestHash = createHash("sha256").update(JSON.stringify({ serviceIds: [...serviceIds].sort(), stylistId: args.stylistId, locationId: args.locationId || null, startTime: args.startTime, clientName, clientEmail, clientPhone, notes: args.clientNotes || "", policyVersion: args.policyVersion || null })).digest("hex");
    const requestKey = createHash("sha256").update(`${context.session?.itemId || "guest"}:${args.requestKey || requestHash}`).digest("hex");

    if (serviceIds.length === 0) {
      return { success: false, appointmentId: null, error: "Choose at least one service" };
    }
    if (serviceIds.length > 10) {
      return { success: false, appointmentId: null, error: "Too many services were selected" };
    }
    if (!clientName || clientName.length > 120) {
      return { success: false, appointmentId: null, error: "Client name is required" };
    }
    if (!clientEmail || clientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return { success: false, appointmentId: null, error: "A valid email address is required" };
    }
    if (clientPhone.length > 40 || (args.clientNotes?.length || 0) > 2_000) {
      return { success: false, appointmentId: null, error: "Booking contact details are too long" };
    }
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() || start.getTime() > Date.now() + 366 * 24 * 60 * 60_000) {
      return { success: false, appointmentId: null, error: "Appointment start time is invalid" };
    }

    try {
      const booking = await serializable(context, async (transactionContext) => {
        if (isOperator) await assertFreshBookingOperator(transactionContext);
        const sudo = transactionContext.sudo();
        await transactionContext.prisma.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "salon-booking-request", requestKey);
        // Narrow idempotency infrastructure lookup; ownership is the request's
        // actor scope + exact request fingerprint, not an email-to-client claim.
        const replay = await transactionContext.prisma.appointment.findFirst({ where: { metadata: { path: ["bookingRequestKey"], equals: requestKey } }, select: { id: true, metadata: true } });
        if (replay) {
          if ((replay.metadata as any)?.bookingRequestHash !== requestHash) throw new Error("Booking request key was reused with different details");
          return { appointmentId: replay.id, duration: 0, services: [], stylistName: "", timezone: "UTC", replayed: true };
        }
        const services = await loadServices(sudo, serviceIds);
        if (!isOperator && services.some((service: any) => service.requiresConsultation || service.requiresPatchTest)) throw new Error("This service requires salon-assisted consultation or patch-test clearance before booking");
        await lockBookingCapacity(transactionContext, args.stylistId, services);

        const duration = services.reduce((sum: number, service: any) => sum + Number(service.baseDuration || 0), 0) || 60;
        const end = new Date(start.getTime() + duration * 60_000);
        const location = await getRuntimeLocation(sudo, args.locationId);
        const availability = await computeStylistAvailability({
          sudo,
          stylistId: args.stylistId,
          date: zonedDateKey(start, location.timezone),
          serviceDuration: duration,
          serviceIds,
          locationId: location.locationId,
        });
        const selectedSlot = availability.slots.find((slot) => new Date(slot.startTime).getTime() === start.getTime());
        if (!selectedSlot?.available) {
          throw new Error(selectedSlot?.blockedReason || "Selected time is outside the stylist's schedule");
        }
        const stylistName = availability.stylistName;
        if (services.some((service: any) => !service.specialists?.some((stylist: any) => stylist.id === args.stylistId))) {
          throw new Error("Selected practitioner is not qualified for every booked service");
        }
        const resourceId = selectedSlot.resourceId;
        const client = await resolveAuthorizedClient(
          sudo,
          { name: clientName, email: clientEmail, phone: clientPhone },
          isOperator ? undefined : context.session?.itemId,
          isOperator,
        ) ?? await resolveGuestClient(sudo, { name: clientName, email: clientEmail, phone: clientPhone });

        const appointment = await sudo.query.Appointment.createOne({
          data: {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            duration,
            status: "pending",
            depositAmount: services.reduce((sum: number, service: any) => sum + Number(service.depositAmount || 0), 0),
            depositPaid: false,
            location: availability.locationId ? { connect: { id: availability.locationId } } : undefined,
            client: { connect: { id: client.id } },
            stylist: { connect: { id: args.stylistId } },
            resource: resourceId ? { connect: { id: resourceId } } : undefined,
            services: { connect: serviceIds.map((id) => ({ id })) },
            clientNotes: args.clientNotes?.trim() || "",
            metadata: {
              source: "storefront_booking",
              bookingRequestKey: requestKey, bookingRequestHash: requestHash,
              guest: client.user ? null : { name: clientName, email: clientEmail, phone: clientPhone },
              clientPolicySnapshot: {
                version: policy.version,
                effectiveFrom: new Date().toISOString(),
                effectiveUntil: null,
                revokedAt: null,
                cancellationNoticeMinutes: policy.cancellationNoticeMinutes,
                rescheduleNoticeMinutes: policy.rescheduleNoticeMinutes,
                cancellationDeadline: new Date(start.getTime() - policy.cancellationNoticeMinutes * 60_000).toISOString(),
                rescheduleDeadline: new Date(start.getTime() - policy.rescheduleNoticeMinutes * 60_000).toISOString(),
                acceptedAt: args.policyAccepted === true && args.policyVersion === policy.version ? new Date().toISOString() : null,
              },
            },
          },
          query: "id",
        });
        const bookedLines: Array<{ id: string; service: any; duration: number }> = [];
        for (const service of services) {
          const snapshot = captureServiceSnapshot(service);
          const line = await sudo.query.AppointmentLineItem.createOne({
            data: {
              appointment: { connect: { id: appointment.id } },
              service: { connect: { id: service.id } },
              staff: { connect: { id: args.stylistId } },
              serviceTitle: snapshot.serviceTitle,
              serviceImagePath: snapshot.serviceImagePath,
              duration: snapshot.duration,
              price: snapshot.price,
              quantity: 1,
              notes: args.clientNotes?.trim() || "",
              metadata: {
                snapshotType: "booking_request",
                snapshotVersion: 1,
                serviceId: service.id,
                serviceName: snapshot.serviceTitle,
                serviceImagePath: snapshot.serviceImagePath,
                serviceBasePrice: service.basePrice,
                servicePrice: snapshot.price,
                requestedStartTime: start.toISOString(),
              },
            },
            query: "id",
          });
          bookedLines.push({ id: line.id, service, duration: snapshot.duration });
        }

        // Public booking writes a complete default segment revision. Operators
        // can later replace it with a versioned processing/parallel plan.
        const domain = sudo.query as any;
        const scheduleShape = bookedLines.map((line, index) => ({
          lineItemId: line.id, stableKey: `service-${index + 1}`, sequence: index,
          startOffsetMinutes: bookedLines.slice(0, index).reduce((sum, item) => sum + item.duration, 0),
          durationMinutes: line.duration, practitionerId: args.stylistId,
          resourceId: resourceId && line.service.requiredResources?.some((resource: any) => resource.id === resourceId) ? resourceId : null,
        }));
        const scheduleKey = `booking:${appointment.id}:schedule:v1`;
        const scheduleHash = createHash("sha256").update(JSON.stringify(scheduleShape)).digest("hex");
        const revision = await domain.AppointmentScheduleRevision.createOne({ data: {
          appointment: { connect: { id: appointment.id } }, revision: 1, nextStart: start.toISOString(), nextEnd: end.toISOString(),
          reason: "Initial booking allocation", actor: context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined,
          actorAuthority: context.session?.itemId ? "authenticated_client_or_operator" : "public_booking_boundary",
          scheduleHash, idempotencyKey: scheduleKey, evidence: { source: "bookAppointment", segmentCount: scheduleShape.length },
        }, query: "id" });
        for (const segment of scheduleShape) {
          const segmentStart = new Date(start.getTime() + segment.startOffsetMinutes * 60_000);
          await domain.AppointmentSegment.createOne({ data: {
            appointment: { connect: { id: appointment.id } }, lineItem: { connect: { id: segment.lineItemId } }, revision: { connect: { id: revision.id } },
            stableKey: segment.stableKey, sequence: segment.sequence, parallelGroup: "", type: "service",
            plannedStart: segmentStart.toISOString(), plannedEnd: new Date(segmentStart.getTime() + segment.durationMinutes * 60_000).toISOString(),
            durationMinutes: segment.durationMinutes, practitionerRequired: true, practitioner: { connect: { id: args.stylistId } },
            resource: segment.resourceId ? { connect: { id: segment.resourceId } } : undefined, resourceUnits: segment.resourceId ? 1 : 0,
            status: "planned", idempotencyKey: `${scheduleKey}:${segment.stableKey}`,
            assignmentEvidence: { source: "booking_snapshot", qualifiedByServiceSpecialist: true, scheduleHash },
          }, query: "id" });
        }

        return { appointmentId: appointment.id, duration, services, stylistName, timezone: location.timezone, replayed: false };
      });

      if (booking.replayed) return { success: true, appointmentId: booking.appointmentId, error: null };
      try {
        const dateStr = start.toLocaleDateString("en-US", {
          timeZone: booking.timezone,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const timeStr = start.toLocaleTimeString("en-US", {
          timeZone: booking.timezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        const totalPrice = booking.services.reduce((sum: number, service: any) => sum + servicePriceCents(service), 0);
        const messageBrand = await getStorefrontMessageBrand(context);

        await sendAppointmentConfirmation({
          to: clientEmail,
          clientName,
          serviceName: booking.services.map((service: any) => service.name).join(", "),
          stylistName: booking.stylistName,
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          duration: booking.duration,
          price: totalPrice / 100,
          storefrontName: messageBrand.name,
          themeHue: messageBrand.themeHue,
        });
      } catch (emailError) {
        console.error("Failed to send appointment confirmation email:", emailError);
      }

      return { success: true, appointmentId: booking.appointmentId, error: null };
    } catch (error) {
      // Authority failures never fall through to idempotent recovery or capacity rechecks.
      if (error instanceof BookingOperatorDenied) return { success: false, appointmentId: null, error: error.message };
      // Recovery can replay a committed booking, so an operator request re-verifies current authority first.
      // A verification that cannot complete is a retryable unresolved outcome, never a raw error or a denial.
      if (isOperator) {
        const verification = await assertFreshBookingOperator(context).then(
          () => ({ verified: true as const }),
          (failure: unknown) => ({ verified: false as const, failure }),
        );
        if (!verification.verified) {
          return { success: false, appointmentId: null, error: verification.failure instanceof BookingOperatorDenied ? verification.failure.message : BOOKING_OUTCOME_UNRESOLVED };
        }
      }
      const recovered = await recoverBookingByIdempotency(context, requestKey, requestHash);
      if (recovered.status === "accepted") return { success: true, appointmentId: recovered.appointmentId, error: null };
      if (recovered.status === "conflict") return { success: false, appointmentId: null, error: BOOKING_REQUEST_KEY_CONFLICT };
      if (recovered.status === "unresolved") return { success: false, appointmentId: null, error: BOOKING_OUTCOME_UNRESOLVED };

      const capacityReason = opaqueAppointmentLifecycleError(error)
        ? await recheckFailedBookingCapacity(context, { serviceIds, stylistId: args.stylistId, locationId: args.locationId, start })
        : null;
      return {
        success: false,
        appointmentId: null,
        error: classifiedBookingError(error, capacityReason),
      };
    }
  },
});
