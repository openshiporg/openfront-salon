import { createHash } from "node:crypto";
import { graphql } from "@keystone-6/core";
import { assertCurrentWorkflowAuthority } from "./currentWorkflowAuthority";
import { acquireSalonCapacityFence } from "../scheduling/capacityFence";
import type { Context } from ".keystone/types";
import defaultSeed from "../../platform/onboarding/lib/seed.json";
import { captureServiceSnapshot } from "../serviceSnapshot";
import { recordInventoryMovement } from "./inventoryWorkflows";
import { currentStockContext } from "../inventory/locationAuthority";
import { acquireStockLedgerFences, registerStockTransaction } from "../inventory/stockFences";
import { STOREFRONT_SETTINGS_SCOPE } from "../models/StoreSettings";
import { parseStorefrontHue } from "../../lib/storefront-theme";
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor, storeLogoHue } from "../../lib/store-logo";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { permissions } from "../access";
import { onboardingAppointmentStart } from "../scheduling/onboarding-date";

const REQUIRED_ARRAYS = [
  "resources", "categories", "services", "stylists", "scheduleBlocks", "clients",
  "intakeForms", "formTemplates", "memberships", "packages", "products",
  "messageTemplates", "appointments", "gallery", "paymentProviders",
] as const;

export type SalonOnboardingResult = {
  success: boolean;
  completed: boolean;
  created: number;
  reused: number;
  locationId: string | null;
  error: string | null;
};

function validateSeed(input: unknown): any {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Salon seed must be an object");
  const seed = input as Record<string, any>;
  if (!seed.salonInfo || typeof seed.salonInfo !== "object" || Array.isArray(seed.salonInfo)) {
    throw new Error("Salon seed requires salonInfo");
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(seed[key])) throw new Error(`Salon seed requires ${key}`);
    if (seed[key].length > 500) throw new Error(`Salon seed ${key} exceeds the 500-item limit`);
  }
  const imagePaths = [
    ...seed.services.map((item: any) => item.imagePath),
    ...seed.stylists.map((item: any) => item.imagePath),
    ...seed.gallery.map((item: any) => item.imagePath),
  ].filter(Boolean);
  if (imagePaths.some((value: unknown) => typeof value !== "string" || !/^\/images\/[a-z0-9_./-]+$/i.test(value) || value.includes(".."))) {
    throw new Error("Salon seed image paths must be canonical relative /images/ paths");
  }
  parseStorefrontHue(seed.salonInfo.themeHue);
  if (typeof seed.salonInfo.name !== "string" || !seed.salonInfo.name.trim() || seed.salonInfo.name.trim().length > 120) {
    throw new Error("Salon seed storefront name must be between 1 and 120 characters");
  }
  if (typeof seed.salonInfo.description !== "string" || seed.salonInfo.description.trim().length > 240) {
    throw new Error("Salon seed storefront description must be 240 characters or fewer");
  }
  for (const service of seed.services) {
    if (!Number.isInteger(service.price) || service.price <= 0 || !Number.isInteger(service.basePrice)) {
      throw new Error(`Service ${service.name || "unknown"} prices must be integer cents`);
    }
  }
  for (const [section, fields] of Object.entries({
    memberships: ["monthlyPrice"],
    packages: ["totalPrice", "savingsAmount"],
    products: ["price", "cost"],
  })) {
    for (const item of seed[section]) {
      for (const field of fields) {
        if (item[field] != null && !Number.isInteger(item[field])) {
          throw new Error(`${section}.${field} must be integer cents`);
        }
      }
    }
  }
  return seed;
}

export async function runSalonOnboardingTransaction(
  context: Context,
  seedInput: unknown = defaultSeed,
): Promise<SalonOnboardingResult> {
  const userId = context.session?.itemId;
  if (!userId || !permissions.canManageOnboarding({ session: context.session })) throw new Error("You do not have permission to run salon onboarding");
  await currentStockContext(context, "onboarding");
  const seed = validateSeed(seedInput);

  return context.transaction(async (transactionContext) => {
    await acquireSalonCapacityFence(transactionContext);
    registerStockTransaction(transactionContext);
    await currentStockContext(transactionContext, "onboarding");
    await acquireStockLedgerFences(transactionContext);
    await transactionContext.prisma.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "salon-authoritative-onboarding",
    );
    await assertCurrentWorkflowAuthority(transactionContext);
    const sudo = transactionContext.sudo();
    let created = 0;
    let reused = 0;

    const findOne = async (list: keyof typeof sudo.query, where: any, query = "id") => {
      const rows = await (sudo.query[list] as any).findMany({ where, take: 1, query });
      return rows[0] || null;
    };
    const createOne = async (list: keyof typeof sudo.query, data: any, query = "id") => {
      created += 1;
      return (sudo.query[list] as any).createOne({ data, query });
    };
    const updateOne = async (list: keyof typeof sudo.query, id: string, data: any, query = "id") => {
      reused += 1;
      return (sudo.query[list] as any).updateOne({ where: { id }, data, query });
    };

    const salon = seed.salonInfo;
    const locationData = {
      name: salon.name, address: salon.address, city: salon.city, state: salon.state,
      zipCode: salon.zipCode, phone: salon.phone, email: salon.email,
      timezone: salon.timezone, hours: salon.hours, isActive: true,
    };
    const existingLocation = await findOne("Location", { name: { equals: salon.name } });
    const location = existingLocation
      ? await updateOne("Location", existingLocation.id, locationData)
      : await createOne("Location", locationData);

    const logoIcon = sanitizeStoreLogoSvg(typeof salon.logoIcon === "string" ? salon.logoIcon : "") || DEFAULT_STORE_LOGO_ICON;
    const logoColor = normalizeStoreLogoColor(salon.logoColor ?? salon.themeHue ?? DEFAULT_STORE_LOGO_COLOR);
    const storeSettingsData = {
      scope: STOREFRONT_SETTINGS_SCOPE,
      name: salon.name,
      description: salon.description || "",
      themeHue: storeLogoHue(logoColor),
      logoIcon,
      logoColor,
      primaryLocation: { connect: { id: location.id } },
    };
    const existingStoreSettings = await findOne("StoreSettings", { scope: { equals: STOREFRONT_SETTINGS_SCOPE } });
    if (existingStoreSettings) await updateOne("StoreSettings", existingStoreSettings.id, storeSettingsData);
    else await createOne("StoreSettings", storeSettingsData);

    const resourceIds: Record<string, string> = {};
    for (const item of seed.resources) {
      const data = {
        name: item.name, type: item.type || "station", capacity: item.capacity || 1,
        isActive: item.isActive ?? true, notes: item.notes || "",
        metadata: { ...(item.metadata || {}), seedKey: item.key, source: "onboarding" },
        location: { connect: { id: location.id } },
      };
      const existing = await findOne("SalonResource", { name: { equals: item.name } });
      const record = existing
        ? await updateOne("SalonResource", existing.id, data)
        : await createOne("SalonResource", data);
      resourceIds[item.key] = record.id;
    }

    const categoryIds: Record<string, string> = {};
    for (const item of seed.categories) {
      const data = {
        name: item.name, description: item.description || "", slug: item.slug,
        displayOrder: item.displayOrder || 0, sortOrder: item.displayOrder || 0,
        isVisible: true, icon: item.icon || "",
      };
      const existing = await findOne("ServiceCategory", { slug: { equals: item.slug } });
      const record = existing
        ? await updateOne("ServiceCategory", existing.id, data)
        : await createOne("ServiceCategory", data);
      categoryIds[item.key] = record.id;
      categoryIds[item.name] = record.id;
    }

    const imageByPath = async (imagePath: string, altText: string, metadata: Record<string, unknown>) => {
      const seedKey = typeof metadata.seedKey === "string" ? metadata.seedKey : null;
      const seededImages = seedKey
        ? await sudo.query.SalonImage.findMany({ take: 500, query: "id metadata" })
        : [];
      const seeded = seededImages.find((image: any) => image.metadata?.seedKey === seedKey);
      const existing = seeded || (!seedKey ? await findOne("SalonImage", { imagePath: { equals: imagePath } }) : null);
      const data = { imagePath, altText, visibility: "public", metadata: { ...metadata, source: "onboarding" } };
      return existing
        ? updateOne("SalonImage", existing.id, data)
        : createOne("SalonImage", data);
    };

    const serviceIds: Record<string, string> = {};
    const serviceRecords: Record<string, any> = {};
    for (const item of seed.services) {
      const image = item.imagePath
        ? await imageByPath(item.imagePath, item.name, { seedKey: `service-image:${item.key}`, placement: "service" })
        : null;
      const resourceConnections = (item.requiredResources || []).map((key: string) => resourceIds[key]).filter(Boolean).map((id: string) => ({ id }));
      const data = {
        name: item.name, description: item.description || "", baseDuration: item.baseDuration,
        price: item.price, basePrice: item.basePrice, depositRequired: item.depositRequired ?? false,
        depositAmount: item.depositAmount || 0, status: "active",
        metadata: { ...(item.metadata || {}), seedKey: item.key, source: "onboarding" },
        category: categoryIds[item.category] ? { connect: { id: categoryIds[item.category] } } : undefined,
        requiredResources: { connect: resourceConnections },
        image: image ? { connect: { id: image.id } } : undefined,
      };
      const existing = await findOne("Service", { name: { equals: item.name } });
      const record = existing
        ? await updateOne("Service", existing.id, data, "id name price basePrice baseDuration image { imagePath image { url } }")
        : await createOne("Service", data, "id name price basePrice baseDuration image { imagePath image { url } }");
      serviceIds[item.key] = record.id;
      serviceRecords[item.key] = record;
    }

    const userIds: Record<string, string> = {};
    const ensureUser = async (person: any) => {
      const existing = await findOne("User", { email: { equals: person.email } }, "id name email");
      if (existing) {
        if (existing.id === userId) throw new Error("Seed people cannot use your own account email");
        reused += 1;
        userIds[person.key] = existing.id;
        return existing;
      }
      const user = await createOne("User", {
        name: person.name, email: person.email, phone: person.phone || "",
        password: `seed_${crypto.randomUUID()}_${crypto.randomUUID()}`,
      }, "id name email");
      userIds[person.key] = user.id;
      return user;
    };

    const stylistIds: Record<string, string> = {};
    for (const item of seed.stylists) {
      const user = await ensureUser(item);
      const image = item.imagePath
        ? await imageByPath(item.imagePath, item.name, { seedKey: `stylist-image:${item.key}`, placement: "stylist" })
        : null;
      const specializations = (item.specializations || []).map((key: string) => serviceIds[key]).filter(Boolean).map((id: string) => ({ id }));
      const data = {
        user: { connect: { id: user.id } }, role: item.role || "stylist", tier: item.tier || "senior",
        bio: item.bio || "", baseCommissionRate: item.baseCommissionRate ?? 0.4,
        commissionRate: item.baseCommissionRate ?? 0.4, status: "active", isActive: true,
        photoUrl: item.imagePath || "", photo: image ? { connect: { id: image.id } } : undefined,
        specializations: { connect: specializations }, locations: { connect: [{ id: location.id }] },
      };
      const existing = await findOne("Stylist", { user: { id: { equals: user.id } } });
      const record = existing
        ? await updateOne("Stylist", existing.id, data)
        : await createOne("Stylist", data);
      stylistIds[item.key] = record.id;
    }

    for (const block of seed.scheduleBlocks) {
      const stylistId = stylistIds[block.stylist];
      for (const dayOfWeek of block.daysOfWeek || []) {
        const where = {
          stylist: { id: { equals: stylistId } }, location: { id: { equals: location.id } }, dayOfWeek: { equals: dayOfWeek },
          startTime: { equals: block.startTime }, endTime: { equals: block.endTime }, type: { equals: "recurring" },
        };
        const existing = await findOne("StylistSchedule", where);
        const data = {
          type: "recurring", dayOfWeek, startTime: block.startTime, endTime: block.endTime,
          breakStart: block.breakStart || "", breakEnd: block.breakEnd || "",
          isAvailable: block.isAvailable ?? true, stylist: { connect: { id: stylistId } },
          location: { connect: { id: location.id } },
          idempotencyKey: `onboarding:schedule:${block.stylist}:${dayOfWeek}:${block.startTime}-${block.endTime}`,
        };
        if (existing) await updateOne("StylistSchedule", existing.id, data);
        else await createOne("StylistSchedule", data);
      }
    }

    const clientIds: Record<string, string> = {};
    for (const item of seed.clients) {
      const user = await ensureUser(item);
      const data = {
        user: { connect: { id: user.id } }, homeLocation: { connect: { id: location.id } },
        preferredStylist: item.preferredStylist && stylistIds[item.preferredStylist]
          ? { connect: { id: stylistIds[item.preferredStylist] } } : undefined,
        hairType: item.hairType, hairTexture: item.hairTexture, skinType: item.skinType,
        notes: item.notes || "", marketingConsent: item.marketingConsent ?? false,
        // Visit/value counters use model defaults on creation; replay must preserve earned totals.
      };
      const existing = await findOne("Client", { user: { id: { equals: user.id } } });
      const record = existing ? await updateOne("Client", existing.id, data) : await createOne("Client", data);
      clientIds[item.key] = record.id;
    }

    for (const item of seed.intakeForms) {
      const services = (item.requiredForServices || []).map((key: string) => serviceIds[key]).filter(Boolean).map((id: string) => ({ id }));
      const data = { name: item.name, fields: item.fields, isActive: true, requiredForServices: { connect: services } };
      const existing = await findOne("IntakeForm", { name: { equals: item.name } });
      if (existing) await updateOne("IntakeForm", existing.id, data); else await createOne("IntakeForm", data);
    }
    for (const item of seed.formTemplates) {
      const data = { name: item.name, type: item.type, description: item.description || "", fields: item.fields, isActive: true };
      const existing = await findOne("FormTemplate", { name: { equals: item.name } });
      if (existing) await updateOne("FormTemplate", existing.id, data); else await createOne("FormTemplate", data);
    }
    for (const item of seed.memberships) {
      const services = (item.includedServices || []).map((key: string) => serviceIds[key]).filter(Boolean).map((id: string) => ({ id }));
      const data = { name: item.name, description: item.description || "", monthlyPrice: item.monthlyPrice, discountPercent: item.discountPercent, isActive: true, includedServices: { connect: services } };
      const existing = await findOne("Membership", { name: { equals: item.name } });
      if (existing) await updateOne("Membership", existing.id, data); else await createOne("Membership", data);
    }
    for (const item of seed.packages) {
      const services = (item.services || []).map((key: string) => serviceIds[key] || Object.entries(serviceRecords).find(([, service]) => service.name === key)?.[1]?.id).filter(Boolean).map((id: string) => ({ id }));
      const data = { name: item.name, description: item.description || "", totalPrice: item.totalPrice, savingsAmount: item.savingsAmount, validDays: item.validDays, isActive: true, services: { connect: services } };
      const existing = await findOne("ServicePackage", { name: { equals: item.name } });
      if (existing) await updateOne("ServicePackage", existing.id, data); else await createOne("ServicePackage", data);
    }
    for (const item of seed.products) {
      const data = { name: item.name, sku: item.sku, price: item.price, cost: item.cost, quantity: item.quantity, reorderPoint: item.reorderPoint, category: item.category, description: item.description || "", isActive: true };
      const existing = await findOne("Product", { sku: { equals: item.sku } });
      if (existing) {
        const { quantity: _seedQuantity, ...catalogData } = data;
        await updateOne("Product", existing.id, catalogData);
      } else {
        const openingQuantity = Math.max(0, Number(item.quantity || 0));
        const product = await createOne("Product", { ...data, quantity: 0 });
        if (openingQuantity > 0) {
          const movement = await recordInventoryMovement(transactionContext, {
            productId: product.id,
            locationId: location.id,
            type: "receive",
            purpose: "onboarding",
            delta: openingQuantity,
            reason: "Opening inventory received during salon onboarding",
            idempotencyKey: `onboarding:inventory:${item.key}:${location.id}`,
            metadata: { source: "onboarding", seedKey: item.key },
          });
          if (!movement.success) throw new Error(movement.error || "Unable to establish opening inventory");
        }
      }
    }
    for (const item of seed.messageTemplates) {
      const data = { name: item.name, type: item.type, content: item.content, variables: item.variables, isActive: true };
      const existing = await findOne("MessageTemplate", { name: { equals: item.name } });
      if (existing) await updateOne("MessageTemplate", existing.id, data); else await createOne("MessageTemplate", data);
    }
    for (const item of seed.gallery) {
      await imageByPath(item.imagePath, item.title, {
        seedKey: `gallery:${item.key}`, placement: "gallery", title: item.title,
        caption: item.caption, serviceId: item.service ? serviceIds[item.service] : null,
      });
    }

    // Earlier browser-sequenced runs could duplicate an image seed key. Keep
    // the referenced record (or the oldest unreferenced gallery record) and
    // remove only unreferenced duplicates inside this transaction.
    const seededImages = await sudo.query.SalonImage.findMany({ take: 500, query: "id metadata createdAt" });
    const imagesBySeedKey = new Map<string, any[]>();
    for (const image of seededImages) {
      const key = typeof image.metadata?.seedKey === "string" ? image.metadata.seedKey : null;
      if (key) imagesBySeedKey.set(key, [...(imagesBySeedKey.get(key) || []), image]);
    }
    const prisma = transactionContext.prisma as any;
    for (const duplicates of imagesBySeedKey.values()) {
      if (duplicates.length < 2) continue;
      const ranked = await Promise.all(duplicates.map(async (image) => ({
        image,
        references: await prisma.service.count({ where: { imageId: image.id } })
          + await prisma.stylist.count({ where: { photoId: image.id } })
          + await prisma.colorFormula.count({ where: { photoId: image.id } })
          + await prisma.product.count({ where: { imageId: image.id } })
          + await prisma.clientNote.count({ where: { photos: { some: { id: image.id } } } }),
      })));
      ranked.sort((a, b) => b.references - a.references || String(a.image.createdAt).localeCompare(String(b.image.createdAt)));
      for (const duplicate of ranked.slice(1)) {
        if (duplicate.references === 0) await sudo.query.SalonImage.deleteOne({ where: { id: duplicate.image.id }, query: "id" });
      }
    }

    const existingAppointments = await sudo.query.Appointment.findMany({ take: 500, query: "id metadata" });
    for (const item of seed.appointments) {
      const existing = existingAppointments.find((appointment: any) => appointment.metadata?.seedKey === item.key);
      if (existing) { reused += 1; continue; }
      const services = (item.services || []).map((key: string) => serviceRecords[key]).filter(Boolean);
      const duration = services.reduce((sum: number, service: any) => sum + Number(service.baseDuration || 0), 0) || 60;
      const start = onboardingAppointmentStart(item, salon.timezone);
      const end = new Date(start.getTime() + duration * 60_000);
      const appointment = await createOne("Appointment", {
        startTime: start.toISOString(), endTime: end.toISOString(), duration,
        status: item.status || "confirmed", depositPaid: item.depositPaid ?? false,
        metadata: { seedKey: item.key, source: "onboarding" }, notes: item.notes || "",
        location: { connect: { id: location.id } }, client: clientIds[item.client] ? { connect: { id: clientIds[item.client] } } : undefined,
        stylist: stylistIds[item.stylist] ? { connect: { id: stylistIds[item.stylist] } } : undefined,
        services: { connect: services.map((service: any) => ({ id: service.id })) },
        lineItems: { create: services.map((service: any) => {
          const snapshot = captureServiceSnapshot(service);
          return {
            service: { connect: { id: service.id } },
            staff: stylistIds[item.stylist] ? { connect: { id: stylistIds[item.stylist] } } : undefined,
            serviceTitle: snapshot.serviceTitle, serviceImagePath: snapshot.serviceImagePath,
            duration: snapshot.duration, price: snapshot.price,
            quantity: 1, notes: item.notes || "",
            metadata: {
              seedKey: `${item.key}:${service.id}`, source: "onboarding", snapshotVersion: 1,
              serviceName: snapshot.serviceTitle, serviceImagePath: snapshot.serviceImagePath,
            },
          };
        }) },
      }, "id lineItems(orderBy: { createdAt: asc }) { id duration }");

      // Same initial schedule revision and segments as a storefront booking, so
      // seeded appointments can be rescheduled and progressed like real ones.
      const stylistId = stylistIds[item.stylist];
      const scheduleShape = (appointment.lineItems || []).map((line: any, index: number, lines: any[]) => ({
        lineItemId: line.id, stableKey: `service-${index + 1}`, sequence: index,
        startOffsetMinutes: lines.slice(0, index).reduce((sum: number, other: any) => sum + Number(other.duration || 0), 0),
        durationMinutes: Number(line.duration || 0), practitionerId: stylistId || null,
      }));
      const scheduleKey = `booking:${appointment.id}:schedule:v1`;
      const scheduleHash = createHash("sha256").update(JSON.stringify(scheduleShape)).digest("hex");
      const revision = await createOne("AppointmentScheduleRevision", {
        appointment: { connect: { id: appointment.id } }, revision: 1, nextStart: start.toISOString(), nextEnd: end.toISOString(),
        reason: "Initial booking allocation", actor: { connect: { id: userId } }, actorAuthority: "onboarding",
        scheduleHash, idempotencyKey: scheduleKey, evidence: { source: "runSalonOnboarding", segmentCount: scheduleShape.length },
      });
      for (const segment of scheduleShape) {
        const segmentStart = new Date(start.getTime() + segment.startOffsetMinutes * 60_000);
        await createOne("AppointmentSegment", {
          appointment: { connect: { id: appointment.id } }, lineItem: { connect: { id: segment.lineItemId } }, revision: { connect: { id: revision.id } },
          stableKey: segment.stableKey, sequence: segment.sequence, parallelGroup: "", type: "service",
          plannedStart: segmentStart.toISOString(), plannedEnd: new Date(segmentStart.getTime() + segment.durationMinutes * 60_000).toISOString(),
          durationMinutes: segment.durationMinutes, practitionerRequired: true,
          practitioner: segment.practitionerId ? { connect: { id: segment.practitionerId } } : undefined,
          resourceUnits: 0, status: "planned", idempotencyKey: `${scheduleKey}:${segment.stableKey}`,
          assignmentEvidence: { source: "booking_snapshot", qualifiedByServiceSpecialist: true, scheduleHash },
        });
      }
    }

    for (const item of seed.paymentProviders) {
      const data = {
        name: item.name, code: item.code, adapter: item.adapter,
        isInstalled: item.isInstalled ?? false, isDefault: item.isDefault ?? false,
        config: item.config || {},
      };
      const existing = await findOne("PaymentProvider", { code: { equals: item.code } });
      if (!existing) await createOne("PaymentProvider", data);
    }

    await sudo.query.User.updateOne({
      where: { id: userId },
      data: { onboardingStatus: "completed" },
      query: "id",
    });

    return { success: true, completed: true, created, reused, locationId: location.id, error: null };
  }, { maxWait: 5_000, timeout: 120_000, isolationLevel: "Serializable" as any });
}

const resultType = graphql.object<SalonOnboardingResult>()({
  name: "RunSalonOnboardingResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    completed: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    created: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    reused: graphql.field({ type: graphql.nonNull(graphql.Int) }),
    locationId: graphql.field({ type: graphql.ID }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const runSalonOnboarding = graphql.field({
  type: resultType,
  args: { seed: graphql.arg({ type: graphql.JSON }) },
  async resolve(_source, { seed }, context: Context) {
    return runSalonOnboardingTransaction(context, seed ?? defaultSeed);
  },
});
