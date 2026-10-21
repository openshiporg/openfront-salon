import { graphql } from "@keystone-6/core";
import type { Context } from ".keystone/types";
import { permissions } from "../access";
import { serializableWorkflow } from "./serializableWorkflow";

type ResourceResult = { success: boolean; resourceId: string | null; revision: number | null; error: string | null };
const denied = { success: false, resourceId: null, revision: null };
const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"] as const;
const ACTIVE_SEGMENT_STATUSES = ["planned", "started"] as const;

async function assertResourceHasNoActiveAssignments(sudo: ReturnType<Context["sudo"]>, resourceId: string) {
  const activeAppointments = await sudo.query.Appointment.count({
    where: { resource: { id: { equals: resourceId } }, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] } },
  });
  if (activeAppointments > 0) throw new Error("Resource has active appointments and cannot be disabled");

  const activeSegments = await sudo.query.AppointmentSegment.findMany({
    where: {
      resource: { id: { equals: resourceId } },
      appointment: { status: { in: [...ACTIVE_APPOINTMENT_STATUSES] } },
      status: { in: [...ACTIVE_SEGMENT_STATUSES] },
    },
    take: 1,
    query: "id",
  });
  if (activeSegments.length > 0) throw new Error("Resource has active segment assignments and cannot be disabled");
}

export async function setSalonResourceAvailabilityTransaction(context: Context, input: {
  resourceId: string; isActive: boolean; expectedRevision: number;
}): Promise<ResourceResult> {
  if (!permissions.canManageResources({ session: context.session as any })) {
    return { ...denied, error: "You must be an authorized salon operator" };
  }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    return { ...denied, error: "A valid resource revision is required" };
  }
  try {
    return await serializableWorkflow(context, "salon-resource", [`resource:${input.resourceId}`], async (transactionContext) => {
      const sudo = transactionContext.sudo();
      const resource = await sudo.query.SalonResource.findOne({
        where: { id: input.resourceId }, query: "id isActive revision location { id isActive }",
      });
      if (!resource) throw new Error("Resource not found");
      if (!resource.location?.id || resource.location.isActive === false) throw new Error("Resource location is unavailable");
      if (resource.isActive === input.isActive) {
        return { success: true, resourceId: resource.id, revision: resource.revision, error: null };
      }
      if (resource.revision !== input.expectedRevision) throw new Error("Resource was changed by another operator");
      if (!input.isActive) await assertResourceHasNoActiveAssignments(sudo, resource.id);
      const revision = resource.revision + 1;
      await sudo.query.SalonResource.updateOne({
        where: { id: resource.id }, data: { isActive: input.isActive, revision }, query: "id",
      });
      return { success: true, resourceId: resource.id, revision, error: null };
    });
  } catch (error) {
    return { ...denied, error: error instanceof Error ? error.message : "Resource update failed" };
  }
}

const resultType = graphql.object<ResourceResult>()({
  name: "SalonResourceWorkflowResult",
  fields: {
    success: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    resourceId: graphql.field({ type: graphql.ID }),
    revision: graphql.field({ type: graphql.Int }),
    error: graphql.field({ type: graphql.String }),
  },
});

export const setSalonResourceAvailability = graphql.field({
  type: resultType,
  args: {
    resourceId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    isActive: graphql.arg({ type: graphql.nonNull(graphql.Boolean) }),
    expectedRevision: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
  },
  resolve(_source, args, context: Context) { return setSalonResourceAvailabilityTransaction(context, args); },
});
