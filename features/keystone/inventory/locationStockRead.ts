import type { Context } from ".keystone/types";
import { assertCheckoutLocation, assertStockLocation } from "./locationAuthority";

export type LocationStockPage = {
  location: { id: string; name: string };
  products: { id: string; name: string; sku: string | null; price: number; localQuantity: number }[];
  skip: number;
  take: number;
  hasMore: boolean;
};

export async function readLocationStock(context: Context, input: {
  appointmentId?: string | null; locationId?: string | null; skip?: number | null; take?: number | null; search?: string | null;
}): Promise<LocationStockPage> {
  const skip = input.skip ?? 0; const take = input.take ?? 30; const search = input.search?.trim() || "";
  if (!Number.isInteger(skip) || skip < 0 || skip > 2147483647 - take || !Number.isInteger(take) || take < 1 || take > 30 || search.length > 80
    || Boolean(input.appointmentId) === Boolean(input.locationId)) throw new Error("Choose one stock scope and a bounded product page");
  const authorize = () => input.appointmentId
    ? assertCheckoutLocation(context, input.appointmentId)
    : assertStockLocation(context, input.locationId!, "adjust");
  const scoped = await authorize();
  const products = await scoped.context.query.Product.findMany({
    where: { isActive: { equals: true }, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {}) },
    take: take + 1, skip, orderBy: [{ name: "asc" }, { id: "asc" }], query: "id name sku price",
  });
  const page = products.slice(0, take);
  // Narrow read-only Prisma aggregation: normal Context proved current actor,
  // capability and exact location first. Sum ALL deltas, never a movement sample
  // or balanceAfter timestamp. Output/work scope is bounded to this product page.
  const balances = page.length ? await scoped.context.prisma.inventoryMovement.groupBy({
    by: ["productId"], where: { locationId: scoped.location.id, productId: { in: page.map(product => product.id) } }, _sum: { delta: true },
  }) : [];
  const quantities = new Map<string, number>();
  for (const row of balances) {
    if (!row.productId || !page.some(product => product.id === row.productId) || quantities.has(row.productId)
      || !Number.isSafeInteger(row._sum.delta) || row._sum.delta! < 0 || row._sum.delta! > 2147483647) throw new Error("Location ledger requires reconciliation");
    quantities.set(row.productId, row._sum.delta!);
  }
  const rechecked = await authorize();
  if (rechecked.location.id !== scoped.location.id) throw new Error("Stock location changed; reload before continuing");
  return {
    location: scoped.location, skip, take, hasMore: products.length > take,
    products: page.map(product => {
      if (typeof product.name !== "string" || !Number.isSafeInteger(product.price) || product.price < 0) throw new Error("Product data could not be verified");
      return { id: product.id, name: product.name, sku: product.sku || null, price: product.price, localQuantity: quantities.get(product.id) ?? 0 };
    }),
  };
}
