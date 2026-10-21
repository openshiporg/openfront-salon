import type { Context } from ".keystone/types";
import { permissions, type Session } from "../access";

export type StockPurpose = "read" | "adjust" | "checkout" | "history" | "onboarding" | "return";
const denied = () => new Error("Current stock permission and location assignment could not be verified");

/** Cookie role flags are not sufficient for a stock read, write, or replay. */
export async function currentStockContext(context: Context, purpose: StockPurpose): Promise<Context> {
  if (!context.session?.itemId || context.session.listKey !== "User") throw denied();
  const actor = await context.query.User.findOne({
    where: { id: context.session.itemId },
    query: "id name role { id name canManageSalon canManageInventory canManagePayments canViewReports canManageOnboarding canIssueRefunds }",
  });
  if (!actor || actor.id !== context.session.itemId || !actor.role) throw denied();
  const session = { ...context.session, data: { ...context.session.data, role: actor.role } } as Session;
  const allowed = purpose === "onboarding" ? permissions.canManageOnboarding({ session })
    : purpose === "return" ? permissions.canIssueRefunds({ session })
    : purpose === "adjust" ? permissions.canManageInventory({ session })
    : purpose === "checkout" ? permissions.canManagePayments({ session })
    : purpose === "history" ? permissions.canManageInventory({ session }) || permissions.canViewReports({ session })
    : permissions.canManageInventory({ session }) || permissions.canManagePayments({ session });
  if (!allowed) throw denied();
  return context.withSession(session);
}

/** Active staff assignments already owned by the controlled staff workflow; never infer all locations from an empty assignment. */
export function stockLocationWhere(context: Context) {
  return {
    isActive: { equals: true },
    ...(permissions.canManageSalon({ session: context.session as Session }) ? {} : {
      stylists: { some: { user: { id: { equals: context.session!.itemId } }, isActive: { equals: true }, status: { equals: "active" as const } } },
    }),
  };
}

export async function assertStockLocation(context: Context, locationId: string, purpose: StockPurpose) {
  if (typeof locationId !== "string" || !locationId || locationId.length > 200) throw denied();
  const current = await currentStockContext(context, purpose);
  const locations = await current.query.Location.findMany({
    // Explicit onboarding capability owns new seed opening stock; it does not
    // require a fabricated staff assignment or the ordinary inventory flag.
    where: { AND: [{ id: { equals: locationId } }, purpose === "onboarding" ? { isActive: { equals: true } } : stockLocationWhere(current)] }, take: 1, query: "id name",
  });
  if (locations.length !== 1 || locations[0].id !== locationId || typeof locations[0].name !== "string") throw denied();
  return { context: current, location: { id: locationId, name: locations[0].name as string } };
}

/** Checkout location is server-owned; caller-selected locations cannot redirect a sale. */
export async function assertCheckoutLocation(context: Context, appointmentId: string) {
  const current = await currentStockContext(context, "checkout");
  const appointment = await current.query.Appointment.findOne({ where: { id: appointmentId }, query: "id location { id }" });
  if (!appointment || appointment.id !== appointmentId || !appointment.location?.id) throw denied();
  return assertStockLocation(current, appointment.location.id, "checkout");
}
