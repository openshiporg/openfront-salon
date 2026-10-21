import { graphql } from "@keystone-6/core"
import { permissions } from "../access"

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
    startDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
    endDate: graphql.arg({ type: graphql.nonNull(graphql.String) }),
  },
  async resolve(source, args, context: any) {
    if (!permissions.canManageCommissions({ session: context.session })) {
      throw new Error("Not authorized to calculate commissions")
    }

    const { stylistId, startDate, endDate } = args
    const sudo = context.sudo()

    const stylist = await sudo.query.Stylist.findOne({
      where: { id: stylistId },
      query: "id user { name } commissionRate tier",
    })

    if (!stylist) {
      throw new Error("Stylist not found")
    }

    const stylistName = stylist.user?.name || "Unknown Stylist"

    let commissionRate = stylist.commissionRate
    if (!commissionRate) {
      switch (stylist.tier) {
        case "master":
          commissionRate = 0.5
          break
        case "senior":
          commissionRate = 0.45
          break
        case "junior":
          commissionRate = 0.35
          break
        default:
          commissionRate = 0.4
      }
    }

    const start = new Date(`${startDate}T00:00:00`)
    const end = new Date(`${endDate}T23:59:59.999`)

    const appointments = await sudo.query.Appointment.findMany({
      where: {
        stylist: { id: { equals: stylistId } },
        startTime: {
          gte: start.toISOString(),
          lte: end.toISOString(),
        },
        status: { equals: "completed" },
      },
      query: `
        id
        startTime
        client { user { name } }
        services {
          id
          name
          price
          basePrice
        }
      `,
    })

    let totalServiceRevenue = 0
    let totalServiceCommission = 0

    const appointmentCommissions = appointments.map((appointment: any) => {
      const services = appointment.services || []
      let appointmentRevenue = 0
      let appointmentCommission = 0

      const serviceDetails = services.map((service: any) => {
        const serviceRevenue = service.price || service.basePrice || 0
        const serviceCommission = Math.round(serviceRevenue * commissionRate)

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
        date: new Date(appointment.startTime).toISOString().split("T")[0],
        clientName: appointment.client?.user?.name || "Walk-in",
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

export const commissionExtension = graphql.extend((base) => ({
  query: {
    calculateCommission,
  },
}))
