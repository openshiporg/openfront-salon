import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { currentStockContext, stockLocationWhere } from "../inventory/locationAuthority";

const sections = ["clients", "catalog", "benefits", "inventory", "engagement", "administration", "reports", "integrations"] as const;
type Section = typeof sections[number];
type Metric = { label: string; value: number; format: string };
type RecordItem = { id: string; title: string; subtitle: string | null; status: string | null; detail: string | null; amount: number | null; metric: number | null; occurredAt: string | null; href: string | null; action: string | null };
type Result = { actorId?: string | null; section: string; title: string; description: string; attentionCount: number; attentionLabel?: string | null; metrics: Metric[]; records: RecordItem[] };

const definitions: Record<Section, Pick<Result, "title" | "description">> = {
  clients: { title: "Clients", description: "Client relationships, visit history, and follow-up." },
  catalog: { title: "Services & catalog", description: "Services, pricing, duration, and categories." },
  benefits: { title: "Memberships & benefits", description: "Memberships, packages, and gift-card balances." },
  inventory: { title: "Retail inventory", description: "Retail stock levels and adjustments." },
  engagement: { title: "Waitlist & communications", description: "Waitlist entries and message delivery." },
  administration: { title: "Staff & locations", description: "Staff, locations, and resources." },
  reports: { title: "Reports", description: "Recent payments, refunds, and unpaid commissions." },
  integrations: { title: "Integrations & exceptions", description: "Payment providers, webhooks, and event delivery." },
};

const metricType = graphql.object<Metric>()({ name: "SalonWorkspaceMetric", fields: {
  label: graphql.field({ type: graphql.nonNull(graphql.String) }), value: graphql.field({ type: graphql.nonNull(graphql.Int) }), format: graphql.field({ type: graphql.nonNull(graphql.String) }),
} });
const recordType = graphql.object<RecordItem>()({ name: "SalonWorkspaceRecord", fields: {
  id: graphql.field({ type: graphql.nonNull(graphql.ID) }), title: graphql.field({ type: graphql.nonNull(graphql.String) }), subtitle: graphql.field({ type: graphql.String }),
  status: graphql.field({ type: graphql.String }), detail: graphql.field({ type: graphql.String }), amount: graphql.field({ type: graphql.Int }), metric: graphql.field({ type: graphql.Int }),
  occurredAt: graphql.field({ type: graphql.String }), href: graphql.field({ type: graphql.String }), action: graphql.field({ type: graphql.String }),
} });
const resultType = graphql.object<Result>()({ name: "SalonOperationsWorkspace", fields: {
  actorId: graphql.field({ type: graphql.ID }),
  section: graphql.field({ type: graphql.nonNull(graphql.String) }), title: graphql.field({ type: graphql.nonNull(graphql.String) }), description: graphql.field({ type: graphql.nonNull(graphql.String) }),
  attentionCount: graphql.field({ type: graphql.nonNull(graphql.Int) }), attentionLabel: graphql.field({ type: graphql.String }), metrics: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(metricType))) }), records: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(recordType))) }),
} });

const usd = (cents: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
const money = (label: string, value: number): Metric => ({ label, value: Math.round(value), format: "money" });
const count = (label: string, value: number): Metric => ({ label, value, format: "count" });
const text = (value: unknown, fallback = "—") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const humanize = (value: unknown) => String(value || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const attention = (attentionCount: number, label: string) => ({ attentionCount, attentionLabel: attentionCount ? `${attentionCount} ${label}` : null });
const date = (value: unknown) => value ? new Date(value as string).toISOString() : null;

async function clients(sudo: ReturnType<Context["sudo"]>): Promise<Pick<Result, "metrics" | "records" | "attentionCount" | "attentionLabel">> {
  const [rows, total, repeat] = await Promise.all([
    sudo.query.Client.findMany({ take: 50, orderBy: { updatedAt: "desc" }, query: "id totalVisits lifetimeValue marketingConsent guestName guestEmail user { name email } preferredStylist { user { name } } updatedAt" }),
    sudo.query.Client.count({}), sudo.query.Client.count({ where: { totalVisits: { gt: 1 } } }),
  ]);
  const records = rows.map((row: any) => ({ id: row.id, title: text(row.user?.name || row.guestName, "Unnamed client"), subtitle: row.user?.email || row.guestEmail || null, status: row.user ? (row.marketingConsent ? "Marketing opted in" : "Account") : "Guest", detail: row.preferredStylist?.user?.name ? `Prefers ${row.preferredStylist.user.name}` : "No preferred provider", amount: Number(row.lifetimeValue || 0), metric: Number(row.totalVisits || 0), occurredAt: date(row.updatedAt), href: `/dashboard/platform/clients/${row.id}`, action: null }));
  const noVisits = records.filter((row: any) => !row.metric).length;
  return { metrics: [count("Clients", total), count("Repeat clients", repeat), money("Lifetime value, last 50 clients", records.reduce((sum: number, row: any) => sum + (row.amount || 0), 0))], records, attentionCount: noVisits, attentionLabel: noVisits ? `${noVisits} with no completed visit` : null };
}

async function catalog(sudo: ReturnType<Context["sudo"]>) {
  const [rows, active, categories] = await Promise.all([
    sudo.query.Service.findMany({ take: 50, orderBy: { name: "asc" }, query: "id name status baseDuration price basePrice depositRequired category { name } requiredResources { id }" }),
    sudo.query.Service.count({ where: { status: { equals: "active" } } }), sudo.query.ServiceCategory.count({}),
  ]);
  const records = rows.map((row: any) => { const covered = (row.requiredResources || []).length; return { id: row.id, title: row.name, subtitle: row.category?.name || "Uncategorized", status: row.status || "draft", detail: `${row.baseDuration || 0} min · ${covered ? `${covered} resource option${covered === 1 ? "" : "s"}` : "No resource coverage"}`, amount: Number(row.price ?? row.basePrice ?? 0), metric: covered, occurredAt: null, href: null, action: null }; });
  return { metrics: [count("Active services", active), count("Categories", categories), count("Catalog items", rows.length)], records, ...attention(records.filter((row: any) => row.status !== "active" || row.metric === 0).length, "not bookable") };
}

async function benefits(sudo: ReturnType<Context["sudo"]>) {
  const [memberships, packages, cards, activeCards] = await Promise.all([
    sudo.query.Membership.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name monthlyPrice discountPercent isActive includedServicesCount" }),
    sudo.query.ServicePackage.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name totalPrice savingsAmount validDays isActive servicesCount" }),
    sudo.query.GiftCard.findMany({ take: 20, orderBy: { createdAt: "desc" }, query: "id recipientName currentBalance isActive expiresAt createdAt" }),
    sudo.query.GiftCard.count({ where: { isActive: { equals: true } } }),
  ]);
  const records: RecordItem[] = [
    ...memberships.map((row: any) => ({ id: `membership:${row.id}`, title: row.name, subtitle: `${row.discountPercent || 0}% member discount`, status: row.isActive ? "Active membership" : "Inactive", detail: `${row.includedServicesCount || 0} included services`, amount: row.monthlyPrice || 0, metric: row.includedServicesCount || 0, occurredAt: null, href: null, action: null })),
    ...packages.map((row: any) => ({ id: `package:${row.id}`, title: row.name, subtitle: `${row.validDays || 0} day validity`, status: row.isActive ? "Active package" : "Inactive", detail: `${row.servicesCount || 0} services · ${(row.savingsAmount || 0) > 0 ? "client savings configured" : "no savings"}`, amount: row.totalPrice || 0, metric: row.servicesCount || 0, occurredAt: null, href: null, action: null })),
    ...cards.map((row: any) => ({ id: `gift:${row.id}`, title: text(row.recipientName, "Gift card"), subtitle: "Gift card balance", status: row.isActive ? "Redeemable" : "Inactive", detail: row.expiresAt ? `Expires ${new Date(row.expiresAt).toLocaleDateString("en-US")}` : "No expiry", amount: row.currentBalance || 0, metric: null, occurredAt: date(row.createdAt), href: null, action: null })),
  ];
  return { metrics: [count("Membership plans", memberships.filter((x: any) => x.isActive).length), count("Packages", packages.filter((x: any) => x.isActive).length), count("Active gift cards", activeCards)], records, ...attention(records.filter((row) => row.status === "Inactive").length, "inactive") };
}

async function inventory(context: Context) {
  const [products, movements, locations] = await Promise.all([
    context.query.Product.findMany({ take: 50, orderBy: { quantity: "asc" }, query: "id name sku quantity reorderPoint price isActive updatedAt" }),
    context.query.InventoryMovement.findMany({ take: 20, orderBy: { createdAt: "desc" }, query: "id type delta balanceAfter reason createdAt product { id name } location { name }" }),
    context.query.Location.findMany({ take: 20, where: stockLocationWhere(context), orderBy: { name: "asc" }, query: "id name city state" }),
  ]);
  const low = products.filter((row: any) => row.isActive && Number(row.quantity || 0) <= Number(row.reorderPoint || 0));
  const records: RecordItem[] = [
    ...locations.map((row: any) => ({ id: `location:${row.id}`, title: row.name, subtitle: [row.city, row.state].filter(Boolean).join(", ") || "Inventory location", status: "Stock location", detail: null, amount: null, metric: null, occurredAt: null, href: null, action: null })),
    ...products.map((row: any) => ({ id: `product:${row.id}`, title: row.name, subtitle: row.sku || "No SKU", status: !row.isActive ? "Inactive" : Number(row.quantity || 0) <= Number(row.reorderPoint || 0) ? "Reorder" : "In stock", detail: `${row.quantity || 0} on hand · reorder at ${row.reorderPoint || 0}`, amount: row.price || 0, metric: row.quantity || 0, occurredAt: date(row.updatedAt), href: null, action: row.isActive ? "adjust_inventory" : null })),
    ...movements.slice(0, 10).map((row: any) => ({ id: `movement:${row.id}`, title: row.product?.name || "Inventory movement", subtitle: row.location?.name || "Unscoped location", status: row.type, detail: `${row.delta > 0 ? "+" : ""}${row.delta} · balance ${row.balanceAfter} · ${row.reason}`, amount: null, metric: row.balanceAfter, occurredAt: date(row.createdAt), href: null, action: null })),
  ];
  return { metrics: [count("Active products", products.filter((x: any) => x.isActive).length), count("At or below reorder point", low.length), count("Units on hand", products.reduce((sum: number, x: any) => sum + Number(x.quantity || 0), 0))], records, attentionCount: low.length, attentionLabel: low.length ? `${low.length} to reorder` : null };
}

async function engagement(sudo: ReturnType<Context["sudo"]>) {
  const [waitlist, messageLogs, active, failed, sent] = await Promise.all([
    sudo.query.WaitlistEntry.findMany({ take: 50, orderBy: { createdAt: "asc" }, query: "id guestName status preferredTimeRange dateRangeStart dateRangeEnd createdAt client { name } service { name } preferredStylists { user { name } }" }),
    sudo.query.MessageLog.findMany({ take: 20, orderBy: { sentAt: "desc" }, query: "id channel status sentAt recipient { name } template { name }" }),
    sudo.query.WaitlistEntry.count({ where: { status: { in: ["active", "notified"] } } }), sudo.query.MessageLog.count({ where: { status: { equals: "failed" } } }), sudo.query.MessageLog.count({ where: { status: { in: ["sent", "delivered"] } } }),
  ]);
  const records: RecordItem[] = [
    ...waitlist.map((row: any) => ({ id: row.id, title: row.client?.name || row.guestName || "Waitlist guest", subtitle: row.service?.name || "Any service", status: row.status || "active", detail: [row.preferredTimeRange, row.preferredStylists?.[0]?.user?.name].filter(Boolean).join(" · ") || "Flexible provider and time", amount: null, metric: null, occurredAt: date(row.createdAt), href: null, action: row.status === "active" ? "notify_waitlist" : row.status === "notified" ? "remove_waitlist" : null })),
    ...messageLogs.map((row: any) => ({ id: `message:${row.id}`, title: row.template?.name || `${row.channel || "Message"} communication`, subtitle: row.recipient?.name || "Recipient omitted", status: row.status, detail: row.status === "failed" ? "Delivery failed" : row.channel ? `Sent by ${row.channel}` : null, amount: null, metric: null, occurredAt: date(row.sentAt), href: null, action: null })),
  ];
  return { metrics: [count("Open waitlist", active), count("Messages sent", sent), count("Delivery failures", failed)], records, attentionCount: active + failed, attentionLabel: [active ? `${active} on waitlist` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" · ") || null };
}

async function administration(sudo: ReturnType<Context["sudo"]>) {
  const [locations, stylists, resources] = await Promise.all([
    sudo.query.Location.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name city state timezone isActive stylistsCount resourcesCount" }),
    sudo.query.Stylist.findMany({ take: 50, orderBy: { createdAt: "asc" }, query: "id role status isActive user { name } locations { id name } schedulesCount" }),
    sudo.query.SalonResource.count({ where: { isActive: { equals: true } } }),
  ]);
  const records: RecordItem[] = [
    ...locations.map((row: any) => ({ id: `location:${row.id}`, title: row.name, subtitle: [row.city, row.state].filter(Boolean).join(", ") || row.timezone, status: row.isActive ? "Active location" : "Inactive", detail: `${row.stylistsCount || 0} staff · ${row.resourcesCount || 0} resources`, amount: null, metric: row.stylistsCount || 0, occurredAt: null, href: null, action: null })),
    ...stylists.map((row: any) => ({ id: `stylist:${row.id}`, title: row.user?.name || "Unnamed provider", subtitle: row.locations?.map((x: any) => x.name).join(", ") || "No location assignment", status: row.isActive && row.status !== "inactive" ? "Active staff" : "Inactive", detail: `${humanize(row.role || "stylist")} · ${row.schedulesCount || 0} schedule ${row.schedulesCount === 1 ? "day" : "days"}`, amount: null, metric: row.schedulesCount || 0, occurredAt: null, href: null, action: null })),
  ];
  return { metrics: [count("Active locations", locations.filter((x: any) => x.isActive).length), count("Active staff", stylists.filter((x: any) => x.isActive && x.status !== "inactive").length), count("Active resources", resources)], records, ...attention(records.filter((row) => row.status === "Inactive" || row.subtitle === "No location assignment" || row.metric === 0).length, "inactive, unassigned or without hours") };
}

async function reports(sudo: ReturnType<Context["sudo"]>) {
  const [payments, completed, cancelled, unpaidCommissions] = await Promise.all([
    sudo.query.Payment.findMany({ take: 500, where: { status: { in: ["completed", "partially_refunded", "refunded"] } }, orderBy: { processedAt: "desc" }, query: "id totalAmount tip refundedAmount status paymentMethod processedAt appointment { id location { name } }" }),
    sudo.query.Appointment.count({ where: { status: { equals: "completed" } } }), sudo.query.Appointment.count({ where: { status: { in: ["cancelled", "no_show"] } } }),
    sudo.query.Commission.findMany({ take: 500, where: { isPaid: { equals: false } }, query: "id commissionAmount" }),
  ]);
  const gross = payments.reduce((sum: number, row: any) => sum + Number(row.totalAmount || 0), 0);
  const refunds = payments.reduce((sum: number, row: any) => sum + Number(row.refundedAmount || 0), 0);
  const records = payments.slice(0, 50).map((row: any) => ({ id: row.id, title: `${String(row.paymentMethod || "payment").replace(/_/g, " ").replace(/^./, (c: string) => c.toUpperCase())} payment`, subtitle: row.appointment?.location?.name || "Location not recorded", status: row.status, detail: `${usd(row.tip)} tip · ${usd(row.refundedAmount)} refunded`, amount: Number(row.totalAmount || 0) - Number(row.refundedAmount || 0), metric: null, occurredAt: date(row.processedAt), href: null, action: null }));
  return { metrics: [money("Net payments, last 500 (incl. tax and tips)", gross - refunds), money("Refunds, same payments", refunds), money("Unpaid commissions", unpaidCommissions.reduce((sum: number, x: any) => sum + Number(x.commissionAmount || 0), 0)), count("Completed appointments", completed), count("Cancelled or no-show", cancelled)], records, attentionCount: unpaidCommissions.length, attentionLabel: unpaidCommissions.length ? `${unpaidCommissions.length} unpaid ${unpaidCommissions.length === 1 ? "commission" : "commissions"}` : null };
}

async function integrations(sudo: ReturnType<Context["sudo"]>) {
  const [providers, pending, failed, events, webhooks] = await Promise.all([
    sudo.query.PaymentProvider.findMany({ take: 20, orderBy: { name: "asc" }, query: "id name code adapter isInstalled isDefault" }),
    sudo.query.DomainEvent.count({ where: { status: { equals: "pending" } } }), sudo.query.DomainEvent.count({ where: { status: { equals: "dead_letter" } } }),
    sudo.query.DomainEvent.findMany({ take: 30, where: { status: { in: ["pending", "dead_letter"] } }, orderBy: { occurredAt: "desc" }, query: "id eventType aggregateType aggregateId status attempts occurredAt" }),
    sudo.query.PaymentWebhookEvent.findMany({ take: 30, orderBy: { processedAt: "desc" }, query: "id eventId type status processedAt provider { name }" }),
  ]);
  const records: RecordItem[] = [
    ...providers.map((row: any) => ({ id: `provider:${row.id}`, title: row.name, subtitle: `${row.adapter} · ${row.code}`, status: row.isInstalled ? row.isDefault ? "Installed · default" : "Installed" : "Not installed", detail: null, amount: null, metric: null, occurredAt: null, href: null, action: null })),
    ...events.map((row: any) => ({ id: `event:${row.id}`, title: row.eventType, subtitle: `${row.aggregateType} · ${row.aggregateId}`, status: row.status, detail: `${row.attempts || 0} ${row.attempts === 1 ? "attempt" : "attempts"}`, amount: null, metric: row.attempts || 0, occurredAt: date(row.occurredAt), href: null, action: null })),
    ...webhooks.map((row: any) => ({ id: `webhook:${row.id}`, title: row.type, subtitle: row.provider?.name || "Unknown provider", status: row.status, detail: `Provider event ${row.eventId}`, amount: null, metric: null, occurredAt: date(row.processedAt), href: null, action: null })),
  ];
  return { metrics: [count("Installed providers", providers.filter((x: any) => x.isInstalled).length), count("Queued events", pending), count("Failed events", failed), count("Recent webhooks", webhooks.length)], records, attentionCount: failed, attentionLabel: failed ? `${failed} failed ${failed === 1 ? "event" : "events"}` : null };
}

const loaders: Record<Section, (sudo: ReturnType<Context["sudo"]>) => Promise<any>> = { clients, catalog, benefits, inventory, engagement, administration, reports, integrations };

const sectionPermissions: Record<Section, (args: { session?: any }) => boolean> = {
  clients: permissions.canManageClients,
  catalog: permissions.canManageCatalog,
  benefits: ({ session }) => permissions.canManageCatalog({ session }) || permissions.canManageClients({ session }),
  inventory: permissions.canManageInventory,
  engagement: ({ session }) => permissions.canManageAppointments({ session }) || permissions.canManageClients({ session }),
  administration: permissions.canManageSalon,
  reports: permissions.canViewReports,
  integrations: permissions.canManageIntegrations,
};

export const salonOperationsWorkspace = graphql.field({
  type: resultType,
  args: { section: graphql.arg({ type: graphql.nonNull(graphql.String) }) },
  async resolve(_source, { section }, context: Context): Promise<Result> {
    if (!sections.includes(section as Section)) throw new Error("Unsupported salon operations workspace");
    const key = section as Section;
    if (!sectionPermissions[key]({ session: context.session as any })) throw new Error("You do not have permission for this salon workspace");
    if (key === "inventory") {
      // No elevated ledger reads: current role and model location filters apply.
      const current = await currentStockContext(context, "adjust");
      const data = await inventory(current);
      await currentStockContext(context, "adjust");
      return { actorId: current.session!.itemId, section: key, ...definitions[key], ...data };
    }
    const data = await loaders[key](context.sudo());
    return { section: key, ...definitions[key], ...data };
  },
});
