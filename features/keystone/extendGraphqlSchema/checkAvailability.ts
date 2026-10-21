import { graphql } from "@keystone-6/core";
import { computeStylistAvailability } from "../scheduling/availability";
import { isActiveServiceStatus } from "../serviceStatus";

const TimeSlot = graphql.object<{
  time: string;
  startTime: string;
  available: boolean;
  resourceId?: string | null;
  resourceName?: string | null;
  blockedReason?: string | null;
}>()({
  name: "TimeSlot",
  fields: {
    time: graphql.field({ type: graphql.nonNull(graphql.String) }),
    startTime: graphql.field({ type: graphql.nonNull(graphql.String) }),
    available: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
    resourceId: graphql.field({ type: graphql.String }),
    resourceName: graphql.field({ type: graphql.String }),
    blockedReason: graphql.field({ type: graphql.String }),
  },
});

const AvailabilityResult = graphql.object<{
  stylistId: string;
  stylistName: string;
  date: string;
  timezone: string;
  locationId?: string | null;
  slots: {
    time: string;
    startTime: string;
    available: boolean;
    resourceId?: string | null;
    resourceName?: string | null;
    blockedReason?: string | null;
  }[];
}>()({
  name: "AvailabilityResult",
  fields: {
    stylistId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    stylistName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    date: graphql.field({ type: graphql.nonNull(graphql.String) }),
    timezone: graphql.field({ type: graphql.nonNull(graphql.String) }),
    locationId: graphql.field({ type: graphql.ID }),
    slots: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(TimeSlot))) }),
  },
});

export const checkAvailability = graphql.field({
  type: AvailabilityResult,
  args: {
    stylistId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    date: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    serviceDuration: graphql.arg({ type: graphql.nonNull(graphql.Int) }),
    serviceId: graphql.arg({ type: graphql.ID }),
    locationId: graphql.arg({ type: graphql.ID }),
  },
  async resolve(_source, args, context: any) {
    const sudo = context.sudo();
    let duration = args.serviceDuration;
    if (args.serviceId) {
      const service = await sudo.query.Service.findOne({
        where: { id: args.serviceId }, query: "id status baseDuration",
      });
      if (!service || !isActiveServiceStatus(service.status)) throw new Error("Service is unavailable");
      duration = Number(service.baseDuration || duration);
    }
    return computeStylistAvailability({
      sudo,
      stylistId: args.stylistId,
      date: args.date,
      serviceDuration: duration,
      serviceIds: args.serviceId ? [args.serviceId] : [],
      locationId: args.locationId,
    });
  },
});
