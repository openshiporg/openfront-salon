import { createHash, randomUUID } from "node:crypto";
import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { enqueueDomainEvent } from "../lifecycle";
import { serializableWorkflow } from "./serializableWorkflow";

const config = {
  client: { list: "Client", permission: permissions.canManageClients, fields: ["name", "email", "phone", "homeLocationId"] },
  staff: { list: "Stylist", permission: permissions.canManagePeople, fields: ["name", "email", "phone", "locationIds", "serviceIds", "tier", "role", "status", "baseCommissionRate", "bio", "photoId"] },
  location: { list: "Location", permission: permissions.canManageSalon, fields: ["name", "address", "city", "state", "zipCode", "phone", "email", "timezone", "hours", "isActive"] },
  resource: { list: "SalonResource", permission: permissions.canManageResources, fields: ["name", "type", "locationId", "capacity", "isActive"] },
  product: { list: "Product", permission: permissions.canManageInventory, fields: ["name", "sku", "price", "cost", "reorderPoint", "category", "description", "isActive"] },
  service: { list: "Service", permission: permissions.canManageCatalog, fields: ["name", "description", "price", "baseDuration", "status", "categoryId", "specialistIds", "resourceIds", "depositRequired", "depositAmount", "requiresConsultation", "requiresPatchTest", "imageId", "pricingTier", "bufferMinutes"] },
  category: { list: "ServiceCategory", permission: permissions.canManageCatalog, fields: ["name", "slug", "description", "displayOrder", "sortOrder", "isVisible"] },
} as const;
type Kind = keyof typeof config;
const denied = { success: false, recordId: null };
function ids(value: unknown) { if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== "string" || !id.trim() || id.length > 200)) throw new Error("Relationship selection is invalid"); return [...new Set(value.map(id => (id as string).trim()))] as string[]; }
function text(value: unknown, required = false) { const result = typeof value === "string" ? value.trim() : ""; if ((required && !result) || result.length > 2000) throw new Error("A required text field is missing or too long"); return result; }
function integer(value: unknown, minimum = 0) { if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > 10_000_000) throw new Error("Use a valid integer amount or quantity"); return Number(value); }
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)])); return value; }
const SAFE_MANAGEMENT_ERRORS = new Set(["A required text field is missing or too long", "Relationship selection is invalid", "Use a valid integer amount or quantity", "A valid operation key is required", "Operation input is invalid", "This operation cannot edit the supplied field", "Record not found", "A valid client or staff email is required", "An account already uses that email; do not merge identities without verified ownership", "A valid timezone is required", "Location email is invalid", "Location activity must be boolean", "Location hours are invalid", "Provide valid hours for every weekday", "Timezone changes require explicit schedule migration", "Reschedule active resource reservations before changing capacity or location", "Reschedule active bookings before removing a staff location", "Resource activity must be boolean", "Resource type is invalid", "Product activity must be boolean", "Service status is invalid", "Service duration cannot exceed eight hours", "Staff status is invalid", "Staff location is required", "Staff member has active reservations and cannot be deactivated", "Commission authority is required to change staff compensation", "Category slug is invalid", "Category visibility must be boolean", "Category not found", "Location selection was not found", "Service selection was not found", "Stylist selection was not found", "SalonResource selection was not found", "ServiceCategory selection was not found", "Location has active reservations and cannot be disabled", "A supported role is required", "SalonImage selection was not found", "Deposit cannot exceed the service price", "Service flags must be boolean", "Buffer cannot exceed two hours"]);

export async function saveSalonRecordTransaction(context: Context, args: { kind: string; id?: string | null; input: unknown; idempotencyKey: string }) {
  const kind = args.kind as Kind, definition = Object.hasOwn(config, args.kind) ? config[kind] : undefined;
  if (!definition || !definition.permission({ session: context.session as any })) return { ...denied, error: "You do not have authority for this operation" };
  if (!args.idempotencyKey?.trim() || args.idempotencyKey.trim().length < 12 || args.idempotencyKey.length > 160) return { ...denied, error: "A valid operation key is required" };
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) return { ...denied, error: "Operation input is invalid" };
  const input = args.input as Record<string, any>;
  if (Object.keys(input).some(key => !(definition.fields as readonly string[]).includes(key))) return { ...denied, error: "This operation cannot edit the supplied field" };
  const requestHash = createHash("sha256").update(JSON.stringify(stable({ kind, id: args.id || null, input }))).digest("hex");
  const eventKey = `management:${context.session!.itemId}:${args.idempotencyKey}`;
  try {
    return await serializableWorkflow(context, "salon-management", [eventKey, `${kind}:${args.id || input.email || input.sku || input.name}`], async tx => {
      const sudo = tx.sudo(), query = sudo.query as any;
      const existing = await query.DomainEvent.findOne({ where: { eventKey }, query: "aggregateId payload" });
      if (existing) { if (existing.payload?.requestHash !== requestHash) throw new Error("Operation key was reused with different input"); return { success: true, recordId: existing.aggregateId, error: null }; }
      const priorQueries: Record<Kind, string> = {
        client: "id user { id email } homeLocation { id }",
        staff: "id status tier role baseCommissionRate user { id email } locations { id }",
        location: "id timezone isActive",
        resource: "id capacity isActive location { id }",
        product: "id sku price cost reorderPoint category description isActive",
        service: "id price basePrice baseDuration status category { id } specialists { id } requiredResources { id }",
        category: "id name slug description displayOrder sortOrder isVisible",
      };
      const prior = args.id ? await query[definition.list].findOne({ where: { id: args.id }, query: priorQueries[kind] }) : null;
      if (args.id && !prior) throw new Error("Record not found");
      const connect = async (list: string, id: unknown) => { const record = await query[list].findOne({ where: { id: text(id, true) }, query: "id" }); if (!record) throw new Error(`${list} selection was not found`); return { connect: { id: record.id } }; };
      const activeLocation = async (id: unknown, existingId?: string | null) => { const location = await query.Location.findOne({ where: { id: text(id, true) }, query: "id isActive" }); if (!location || (!location.isActive && location.id !== existingId)) throw new Error("Location selection was not found"); return { connect: { id: location.id } }; };
      const many = async (list: string, value: unknown, existingIds: string[] = [], creating = false) => {
        const selectedIds = ids(value);
        if (!selectedIds.length) return creating ? { connect: [] } : { set: [] };
        const selection = list === "Stylist" ? "id status isActive" : list === "SalonResource" || list === "Location" ? "id isActive" : "id status";
        const records = await query[list].findMany({ where: { id: { in: selectedIds } }, take: selectedIds.length, query: selection });
        if (records.length !== selectedIds.length || records.some((record: any) => (record.status === "inactive" || record.status === "on_leave" || record.isActive === false) && !existingIds.includes(record.id))) throw new Error(`${list} selection was not found`);
        const connections = records.map((record: any) => ({ id: record.id }));
        return creating ? { connect: connections } : { set: connections };
      };
      let data: any = {};
      if (kind === "client" || kind === "staff") {
        const name = text(input.name, true), phone = text(input.phone);
        let userId = prior?.user?.id;
        if (userId) {
          if (input.email && input.email.toLowerCase() !== prior.user.email.toLowerCase()) throw new Error("Account email changes require the separate verified identity workflow");
          await query.User.updateOne({ where: { id: userId }, data: { name, phone }, query: "id" });
        } else {
          const email = text(input.email, true).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid client or staff email is required");
          if (await query.User.findOne({ where: { email }, query: "id" })) throw new Error("An account already uses that email; do not merge identities without verified ownership");
          // Accounts receive an unshared random secret; this workflow never accepts or exposes passwords.
          const user = await query.User.createOne({ data: { name, email, phone, password: `${randomUUID()}-${randomUUID()}` }, query: "id" }); userId = user.id;
        }
        data.user = { connect: { id: userId } };
        if (kind === "client" && Object.hasOwn(input, "homeLocationId")) {
          if (input.homeLocationId) data.homeLocation = await activeLocation(input.homeLocationId, prior?.homeLocation?.id);
          else if (prior) data.homeLocation = { disconnect: true };
        }
        if (kind === "staff") {
          const nextLocationIds = ids(input.locationIds);
          if (!nextLocationIds.length) throw new Error("Staff location is required");
          if (nextLocationIds.some((id: string) => !prior?.locations?.some((location: any) => location.id === id)) || (prior && nextLocationIds.length !== prior.locations.length)) {
            data.locations = await many("Location", nextLocationIds, (prior?.locations || []).map((location: any) => location.id), !prior);
          }
          if (prior) {
            const removedLocations = prior.locations.some((location: any) => !nextLocationIds.includes(location.id));
            if (removedLocations) {
              const appointments = await query.Appointment.count({ where: { stylist: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } });
              const segments = await query.AppointmentSegment.count({ where: { practitioner: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } } });
              if (appointments || segments) throw new Error("Reschedule active bookings before removing a staff location");
            }
          }
          if (input.bio !== undefined) data.bio = text(input.bio);
          if (input.photoId) data.photo = await connect("SalonImage", input.photoId);
          if (input.serviceIds) data.specializations = await many("Service", input.serviceIds, (prior?.specializations || []).map((service: any) => service.id), !prior);
          if (input.tier) { const tier = text(input.tier); if (!["junior", "senior", "master", "celebrity"].includes(tier)) throw new Error("A supported role is required"); data.tier = tier; }
          if (input.role) { const role = text(input.role); if (!["stylist", "colorist", "nail_tech", "esthetician", "massage_therapist", "manager", "receptionist"].includes(role)) throw new Error("A supported role is required"); data.role = role; }
          if (input.baseCommissionRate !== undefined) {
            if (!permissions.canManageCommissions({ session: context.session as any })) throw new Error("Commission authority is required to change staff compensation");
            const rate = Number(input.baseCommissionRate); if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("Commission rate must be a decimal from 0 to 1"); data.baseCommissionRate = rate; data.commissionRate = rate;
          }
          const nextStatus = input.status === undefined ? (prior?.status || "active") : text(input.status);
          if (!["active", "on_leave", "inactive"].includes(nextStatus)) throw new Error("Staff status is invalid");
          if (!prior) { data.role = data.role || "stylist"; data.status = nextStatus; data.isActive = nextStatus === "active"; }
          else if (input.status !== undefined) {
            if (nextStatus !== "active") {
              const appointments = await query.Appointment.count({ where: { stylist: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } });
              const segments = await query.AppointmentSegment.count({ where: { practitioner: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } } });
              if (appointments || segments) throw new Error("Staff member has active reservations and cannot be deactivated");
            }
            data.status = nextStatus; data.isActive = nextStatus === "active";
          }
        }
      } else if (kind === "location") {
        for (const key of ["name", "address", "city", "state", "zipCode"]) data[key] = text(input[key], true);
        data.phone = text(input.phone);
        data.email = text(input.email);
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error("Location email is invalid");
        data.timezone = text(input.timezone, true);
        try { new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }).format(); } catch { throw new Error("A valid timezone is required"); }
        if (input.hours !== undefined) {
          if (!input.hours || typeof input.hours !== "object" || Array.isArray(input.hours)) throw new Error("Location hours are invalid");
          const normalized: Record<string, { open: string | null; close: string | null; closed: boolean }> = {};
          for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
            const h = (input.hours as Record<string, any>)[day];
            if (!h || typeof h.closed !== "boolean") throw new Error("Provide valid hours for every weekday");
            if (h.closed) normalized[day] = { open: null, close: null, closed: true };
            else {
              if (typeof h.open !== "string" || typeof h.close !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close) || h.open >= h.close) throw new Error("Provide valid hours for every weekday");
              normalized[day] = { open: h.open, close: h.close, closed: false };
            }
          }
          data.hours = normalized;
        }
        if (input.isActive !== undefined) {
          if (typeof input.isActive !== "boolean") throw new Error("Location activity must be boolean");
          if (prior && prior.isActive && input.isActive === false) {
            const appointments = await query.Appointment.count({ where: { location: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } });
            if (appointments) throw new Error("Location has active reservations and cannot be disabled");
          }
          data.isActive = input.isActive;
        }
        if (prior && prior.timezone !== data.timezone) {
          const [appointments, schedules] = await Promise.all([
            query.Appointment.count({ where: { location: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } }),
            query.StylistSchedule.count({ where: { location: { id: { equals: prior.id } } } }),
          ]);
          if (appointments || schedules) throw new Error("Timezone changes require explicit schedule migration");
        }
      } else if (kind === "resource") {
        const name = text(input.name, true), type = text(input.type || "station"), capacity = integer(input.capacity, 1);
        if (!["station", "room", "shampoo_bowl", "equipment", "color_bar", "other"].includes(type)) throw new Error("Resource type is invalid");
        const location = await activeLocation(input.locationId, prior?.location?.id);
        const isActive = input.isActive === undefined ? (prior?.isActive ?? true) : input.isActive;
        if (typeof isActive !== "boolean") throw new Error("Resource activity must be boolean");
        if (prior && (prior.capacity !== capacity || prior.location?.id !== input.locationId || prior.isActive !== isActive)) {
          const [booked, segments] = await Promise.all([
            query.Appointment.count({ where: { resource: { id: { equals: prior.id } }, status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } }),
            query.AppointmentSegment.count({ where: { resource: { id: { equals: prior.id } }, status: { in: ["planned", "started"] }, appointment: { status: { in: ["pending", "confirmed", "in_progress"] }, startTime: { gte: new Date() } } } }),
          ]);
          if (booked || segments) throw new Error("Reschedule active resource reservations before changing capacity or location");
        }
        data = { name, type, capacity, location, isActive };
      } else if (kind === "product") {
        data = { name: text(input.name, true), sku: text(input.sku, true), price: integer(input.price), cost: integer(input.cost ?? 0), reorderPoint: integer(input.reorderPoint ?? 5), category: text(input.category), description: text(input.description) };
        if (input.isActive !== undefined) { if (typeof input.isActive !== "boolean") throw new Error("Product activity must be boolean"); data.isActive = input.isActive; }
        // Quantity is never writable here: opening balances use the inventory ledger.
      } else if (kind === "service") {
        const status = input.status ?? (prior?.status || "active");
        if (!["active", "inactive"].includes(status)) throw new Error("Service status is invalid");
        const price = integer(input.price), baseDuration = integer(input.baseDuration, 1);
        if (baseDuration > 480) throw new Error("Service duration cannot exceed eight hours");
        data = { name: text(input.name, true), description: text(input.description), price, basePrice: price, baseDuration, status };
        if (input.categoryId) data.category = await connect("ServiceCategory", input.categoryId);
        else if (input.categoryId !== undefined && prior) data.category = { disconnect: true };
        if (input.specialistIds !== undefined) data.specialists = await many("Stylist", input.specialistIds, (prior?.specialists || []).map((stylist: any) => stylist.id), !prior);
        for (const flag of ["depositRequired", "requiresConsultation", "requiresPatchTest"] as const) {
          if (input[flag] === undefined) continue;
          if (typeof input[flag] !== "boolean") throw new Error("Service flags must be boolean");
          data[flag] = input[flag];
        }
        if (input.depositRequired !== undefined || input.depositAmount !== undefined) {
          const depositAmount = data.depositRequired === false ? 0 : integer(input.depositAmount ?? 0);
          if (depositAmount > price) throw new Error("Deposit cannot exceed the service price");
          data.depositAmount = depositAmount;
        }
        if (input.imageId) data.image = await connect("SalonImage", input.imageId);
        if (input.bufferMinutes !== undefined && input.bufferMinutes !== null && input.bufferMinutes !== "") {
          const buffer = integer(input.bufferMinutes);
          if (buffer > 120) throw new Error("Buffer cannot exceed two hours");
          data.bufferMinutes = buffer;
        }
        if (input.pricingTier !== undefined) {
          if (!input.pricingTier || typeof input.pricingTier !== "object" || Array.isArray(input.pricingTier)) throw new Error("Operation input is invalid");
          const tiers: Record<string, number> = {};
          for (const [tier, cents] of Object.entries(input.pricingTier as Record<string, unknown>)) {
            if (!["junior", "senior", "master", "celebrity"].includes(tier)) throw new Error("Operation input is invalid");
            if (cents === null || cents === "") continue;
            tiers[tier] = integer(cents);
          }
          data.pricingTier = tiers;
        }
        if (input.resourceIds !== undefined) data.requiredResources = await many("SalonResource", input.resourceIds, (prior?.requiredResources || []).map((resource: any) => resource.id), !prior);
      } else if (kind === "category") {
        const name = text(input.name, true);
        const slug = (text(input.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Category slug is invalid");
        const displayOrder = integer(input.displayOrder ?? 0);
        const isVisible = input.isVisible === undefined ? (prior?.isVisible ?? true) : input.isVisible;
        if (typeof isVisible !== "boolean") throw new Error("Category visibility must be boolean");
        data = { name, slug, description: text(input.description), displayOrder, sortOrder: displayOrder, isVisible };
      }
      const record = prior ? await query[definition.list].updateOne({ where: { id: prior.id }, data, query: "id" }) : await query[definition.list].createOne({ data, query: "id" });
      await enqueueDomainEvent(tx, { eventKey, eventType: "salon.management.recorded.v1", aggregateType: kind, aggregateId: record.id, operation: prior ? "update" : "create", payload: { requestHash, fields: Object.keys(input), actorId: context.session!.itemId } });
      return { success: true, recordId: record.id, error: null };
    });
  } catch (error) { return { ...denied, error: error instanceof Error && SAFE_MANAGEMENT_ERRORS.has(error.message) ? error.message : "Record could not be saved; check uniqueness, selections, and active bookings before retrying." }; }
}

const result = graphql.object<{ success: boolean; recordId: string | null; error: string | null }>()({ name: "SalonManagementResult", fields: { success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }), recordId: graphql.field({ type: graphql.ID }), error: graphql.field({ type: graphql.String }) } });
export const saveSalonRecord = graphql.field({ type: result, args: { kind: graphql.arg({ type: graphql.nonNull(graphql.String) }), id: graphql.arg({ type: graphql.ID }), input: graphql.arg({ type: graphql.nonNull(graphql.JSON) }), idempotencyKey: graphql.arg({ type: graphql.nonNull(graphql.String) }) }, resolve(_source, args, context: Context) { return saveSalonRecordTransaction(context, args); } });
export const salonManagementWorkspace = graphql.field({ type: graphql.JSON, args: { kind: graphql.arg({ type: graphql.nonNull(graphql.String) }) }, async resolve(_source, { kind }, context: Context) {
  const definition = Object.hasOwn(config, kind) ? config[kind as Kind] : undefined; if (!definition || !definition.permission({ session: context.session as any })) throw new Error("Management access denied");
  const query = context.sudo().query as any;
  const canManageCompensation = permissions.canManageCommissions({ session: context.session as any });
  const selections: Record<Kind, string> = {
    client: "id guestName guestEmail guestPhone user { name email phone } homeLocation { id }",
    staff: `id tier role status isActive bio photo { id imagePath image { url } } user { name email phone } locations { id } specializations { id }${canManageCompensation ? " baseCommissionRate commissionRate" : ""}`,
    location: "id name address city state zipCode phone email timezone hours isActive",
    resource: "id name type capacity isActive location { id }",
    product: "id name sku price cost reorderPoint category description isActive",
    service: "id name description price basePrice baseDuration bufferMinutes status depositRequired depositAmount requiresConsultation requiresPatchTest image { id imagePath image { url } } category { id } specialists { id } requiredResources { id }",
    category: "id name slug description displayOrder sortOrder isVisible",
  };
  return { records: await query[definition.list].findMany({ take: 100, orderBy: { createdAt: "desc" }, query: selections[kind as Kind] }),
    canManageCompensation,
    locations: await query.Location.findMany({ take: 100, query: "id name isActive" }), services: await query.Service.findMany({ take: 100, query: "id name status" }), resources: await query.SalonResource.findMany({ take: 100, query: "id name isActive" }), stylists: await query.Stylist.findMany({ take: 100, query: "id status isActive user { name }" }), categories: await query.ServiceCategory.findMany({ take: 100, query: "id name isVisible" }) };
} });
