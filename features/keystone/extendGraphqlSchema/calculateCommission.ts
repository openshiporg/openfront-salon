import { graphql } from "@keystone-6/core"
import { Context } from ".keystone/types"

// Define return types for commission calculation
const ServiceCommission = graphql.object<{
  serviceName: string
  revenue: number
  commission: number
}>()({
  name: "ServiceCommission",
  fields: {
    serviceName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    revenue: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    commission: graphql.field({ type: graphql.nonNull(graphql.Float) }),
  },
})

const AppointmentCommission = graphql.object<{
  appointmentId: string
  date: string
  clientName: string
  services: { serviceName: string; revenue: number; commission: number }[]
  totalRevenue: number
  totalCommission: number
}>()({
  name: "AppointmentCommission",
  fields: {
    appointmentId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    date: graphql.field({ type: graphql.nonNull(graphql.String) }),
    clientName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    services: graphql.field({ type: graphql.nonNull(graphql.list(graphql.nonNull(ServiceCommission))) }),
    totalRevenue: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    totalCommission: graphql.field({ type: graphql.nonNull(graphql.Float) }),
  },
})

const CommissionResult = graphql.object<{
  stylistId: string
  stylistName: string
  startDate: string
  endDate: string
  commissionRate: number
  appointments: any[]
  totalServiceRevenue: number
  totalServiceCommission: number
  appointmentCount: number
}>()({
  name: "CommissionResult",
  fields: {
    stylistId: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    stylistName: graphql.field({ type: graphql.nonNull(graphql.String) }),
    startDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    endDate: graphql.field({ type: graphql.nonNull(graphql.String) }),
    commissionRate: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    appointments: graphql.field({
      type: graphql.nonNull(graphql.list(graphql.nonNull(AppointmentCommission))),
    }),
    totalServiceRevenue: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    totalServiceCommission: graphql.field({ type: graphql.nonNull(graphql.Float) }),
    appointmentCount: graphql.field({ type: graphql.nonNull(graphql.Int) }),
  },
})

export const calculateCommission = graphql.field({
  type: CommissionResult,
  args: {
    stylistId: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
    startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }), // YYYY-MM-DD format
    endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }), // YYYY-MM-DD format
  },
  async resolve(source, args, context: Context) {
    const { stylistId, startDate, endDate } = args

    // Get stylist info including commission rate
    const stylist = await context.query.Stylist.findOne({
      where: { id: stylistId },
      query: "id user { name } commissionRate tier",
    })

    if (!stylist) {
      throw new Error("Stylist not found")
    }

    const stylistName = stylist.user?.name || "Unknown Stylist"

    // Default commission rates by tier if not explicitly set
    let commissionRate = stylist.commissionRate
    if (!commissionRate) {
      switch (stylist.tier) {
        case "master":
          commissionRate = 0.50 // 50%
          break
        case "senior":
          commissionRate = 0.45 // 45%
          break
        case "junior":
          commissionRate = 0.35 // 35%
          break
        default:
          commissionRate = 0.40 // 40% default
      }
    }

    // Get completed appointments for the date range
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const appointments = await context.query.Appointment.findMany({
      where: {
        stylist: { id: { equals: stylistId } },
        appointmentDate: {
          gte: start.toISOString(),
          lte: end.toISOString(),
        },
        status: { equals: "completed" },
      },
      query: `
        id
        appointmentDate
        client { name }
        services {
          id
          name
          basePrice
        }
      `,
    })

    // Calculate commissions for each appointment
    let totalServiceRevenue = 0
    let totalServiceCommission = 0

    const appointmentCommissions = appointments.map((appointment: any) => {
      const services = appointment.services || []
      let appointmentRevenue = 0
      let appointmentCommission = 0

      const serviceDetails = services.map((service: any) => {
        const serviceRevenue = service.basePrice || 0
        const serviceCommission = serviceRevenue * commissionRate

        appointmentRevenue += serviceRevenue
        appointmentCommission += serviceCommission

        return {
          serviceName: service.name,
          revenue: serviceRevenue,
          commission: serviceCommission,
        }
      })

      totalServiceRevenue += appointmentRevenue
      totalServiceCommission += appointmentCommission

      return {
        appointmentId: appointment.id,
        date: new Date(appointment.appointmentDate).toISOString().split("T")[0],
        clientName: appointment.client?.name || "Walk-in",
        services: serviceDetails,
        totalRevenue: appointmentRevenue,
        totalCommission: appointmentCommission,
      }
    })

    return {
      stylistId,
      stylistName,
      startDate,
      endDate,
      commissionRate,
      appointments: appointmentCommissions,
      totalServiceRevenue,
      totalServiceCommission,
      appointmentCount: appointments.length,
    }
  },
})

// Export the extended schema
export const commissionExtension = graphql.extend((base) => ({
  query: {
    calculateCommission,
  },
}))
