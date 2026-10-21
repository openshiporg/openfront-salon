export type BookableResource = {
  id: string;
  name?: string | null;
  capacity?: number | null;
  isActive: boolean;
  location?: { id?: string | null } | null;
};

export type ServiceResourceRequirement = {
  name?: string | null;
  requiredResources?: readonly BookableResource[] | null;
};

export function missingRequiredServiceResourceIds(
  requiredResources: readonly Pick<BookableResource, "id">[],
  assignedResourceIds: readonly string[],
) {
  const assigned = new Set(assignedResourceIds);
  return [...new Set(requiredResources.map(resource => resource.id))].filter(id => !assigned.has(id));
}

/**
 * The public booking snapshot can assign one resource to each service segment.
 * Treat Service.requiredResources as mandatory, and fail closed when that
 * contract cannot be represented by the current single-resource plan.
 */
export function resolveBookableServiceResource(
  services: readonly ServiceResourceRequirement[],
  locationId: string,
): BookableResource | null {
  const constrained = services.filter(service => (service.requiredResources?.length || 0) > 0);
  if (!constrained.length) return null;

  const selected: BookableResource[] = [];
  for (const service of constrained) {
    const resources = service.requiredResources || [];
    if (resources.length !== 1) {
      throw new Error(`${service.name || "Selected service"} requires multiple resource assignments; contact the salon to schedule`);
    }
    const resource = resources[0];
    if (!resource?.id || !resource.isActive || resource.location?.id !== locationId) {
      throw new Error(`${service.name || "Selected service"} has no active required resource at this location`);
    }
    selected.push(resource);
  }

  const resourceIds = new Set(selected.map(resource => resource.id));
  if (resourceIds.size !== 1) {
    throw new Error("Selected services require separate resource assignments; contact the salon to schedule");
  }
  return selected[0];
}
