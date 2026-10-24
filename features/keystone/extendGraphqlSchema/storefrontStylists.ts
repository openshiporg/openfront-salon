import { graphql } from "@keystone-6/core"
import type { Context } from ".keystone/types"
import { projectPublicSalonImage } from "./publicImageProjection"
import { storefrontStylistWhere } from "./storefrontStylistFilters"

/**
 * Public-safe storefront stylist read.
 *
 * The public (unauthenticated) storefront cannot read `Stylist.user` because
 * `User` query access is `isSignedIn`. That left every public artist card
 * rendering the fallback "Artist" instead of the linked user's real name. These
 * purpose-built public queries use `context.sudo()` to read only the display
 * fields the storefront needs (name, tier, bio, photo, specializations,
 * schedules) without weakening the signed-in `User` access rule or exposing
 * sensitive account fields (email/phone/role) to anonymous callers.
 */

const StorefrontStylistUser = graphql.object<{ id: string; name: string }>()({
  name: "StorefrontStylistUser",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
})

const StorefrontStylistImage = graphql.object<{ url: string }>()({
  name: "StorefrontStylistImage",
  fields: {
    url: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
})

const StorefrontStylistPhoto = graphql.object<{
  image: { url: string } | null
  imagePath: string | null
  altText: string | null
}>()({
  name: "StorefrontStylistPhoto",
  fields: {
    image: graphql.field({ type: StorefrontStylistImage }),
    imagePath: graphql.field({ type: graphql.String }),
    altText: graphql.field({ type: graphql.String }),
  },
})

const StorefrontSpecialization = graphql.object<{ id: string; name: string }>()({
  name: "StorefrontSpecialization",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    name: graphql.field({ type: graphql.nonNull(graphql.String) }),
  },
})

const StorefrontSchedule = graphql.object<{
  id: string
  dayOfWeek: number | null
  startTime: string | null
  endTime: string | null
  isAvailable: boolean | null
}>()({
  name: "StorefrontSchedule",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    dayOfWeek: graphql.field({ type: graphql.Int }),
    startTime: graphql.field({ type: graphql.String }),
    endTime: graphql.field({ type: graphql.String }),
    isAvailable: graphql.field({ type: graphql.Boolean }),
  },
})

const StorefrontStylist = graphql.object<{
  id: string
  user: { id: string; name: string } | null
  tier: string | null
  role: string | null
  bio: string | null
  isActive: boolean | null
  photo: { image: { url: string } | null; imagePath: string | null; altText: string | null } | null
  specializations: { id: string; name: string }[]
  schedules: {
    id: string
    dayOfWeek: number | null
    startTime: string | null
    endTime: string | null
    isAvailable: boolean | null
  }[]
}>()({
  name: "StorefrontStylist",
  fields: {
    id: graphql.field({ type: graphql.nonNull(graphql.ID) }),
    user: graphql.field({ type: StorefrontStylistUser }),
    tier: graphql.field({ type: graphql.String }),
    role: graphql.field({ type: graphql.String }),
    bio: graphql.field({ type: graphql.String }),
    isActive: graphql.field({ type: graphql.Boolean }),
    photo: graphql.field({ type: StorefrontStylistPhoto }),
    specializations: graphql.field({
      type: graphql.nonNull(graphql.list(graphql.nonNull(StorefrontSpecialization))),
    }),
    schedules: graphql.field({
      type: graphql.nonNull(graphql.list(graphql.nonNull(StorefrontSchedule))),
    }),
  },
})

const STYLIST_SELECTION = `
  id
  user { id name }
  tier
  role
  bio
  isActive
  photo { visibility image { url } imagePath altText }
  specializations { id name }
  schedules { id dayOfWeek startTime endTime isAvailable }
`

function projectStorefrontStylist(stylist: any) {
  return { ...stylist, photo: projectPublicSalonImage(stylist.photo) }
}

export const storefrontStylists = graphql.field({
  type: graphql.nonNull(graphql.list(graphql.nonNull(StorefrontStylist))),
  args: {
    serviceId: graphql.arg({ type: graphql.ID }),
    take: graphql.arg({ type: graphql.Int }),
  },
  async resolve(source, args, context: Context) {
    const sudo = context.sudo()
    const take = args.take && args.take > 0 ? Math.min(args.take, 100) : 100

    // Booking availability also rejects non-active employment status. Keep the
    // all-artist roster policy as-is; constrain service-specific candidates to
    // the same active status and specialization the booking command rechecks.
    const where = storefrontStylistWhere(args.serviceId)

    const stylists = await sudo.query.Stylist.findMany({
      where,
      take,
      orderBy: { tier: "desc" },
      query: STYLIST_SELECTION,
    })

    return stylists.map(projectStorefrontStylist) as any
  },
})

export const storefrontStylist = graphql.field({
  type: StorefrontStylist,
  args: {
    id: graphql.arg({ type: graphql.nonNull(graphql.ID) }),
  },
  async resolve(source, args, context: Context) {
    const sudo = context.sudo()

    const stylist = await sudo.query.Stylist.findOne({
      where: { id: args.id },
      query: STYLIST_SELECTION,
    })

    return stylist ? projectStorefrontStylist(stylist) as any : null
  },
})