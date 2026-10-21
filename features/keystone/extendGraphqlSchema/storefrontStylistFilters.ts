export function storefrontStylistWhere(serviceId?: string | null): Record<string, unknown> {
  const where: Record<string, unknown> = { isActive: { equals: true } };
  if (serviceId !== undefined && serviceId !== null) {
    where.status = { equals: "active" };
    where.specializations = { some: { id: { equals: serviceId } } };
  }
  return where;
}
