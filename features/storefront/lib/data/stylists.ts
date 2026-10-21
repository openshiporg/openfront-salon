"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"
import { cache } from "react"
import { isQualifiedStylistSelection, resolveBookingSelectionRead, type BookingSelectionRead } from "./bookingSelectionRead"

export interface Stylist {
  id: string
  tier: "junior" | "senior" | "master" | "celebrity" | null
  bio: string | null
  commissionRate?: number
  certifications?: string | null
  isActive: boolean
  user: {
    id: string
    name: string
    email?: string
  } | null
  photo: {
    image: {
      url: string
    } | null
    imagePath: string | null
    altText: string | null
  } | null
  specializations: {
    id: string
    name: string
  }[]
  schedules: {
    id: string
    dayOfWeek: number | null
    startTime: string
    endTime: string
    isAvailable: boolean
  }[]
}

// The public (unauthenticated) storefront client cannot resolve the
// signed-in-only `Stylist.user` relation, so stylist reads go through the
// purpose-built `storefrontStylists` / `storefrontStylist` extension queries,
// which surface display-only fields (name, tier, bio, photo, specializations,
// schedules) via an elevated resolver without weakening `User` access.
const STYLIST_FRAGMENT = gql`
  fragment StorefrontStylistFields on StorefrontStylist {
    id
    user {
      id
      name
    }
    tier
    bio
    isActive
    photo {
      image {
        url
      }
      imagePath
      altText
    }
    specializations {
      id
      name
    }
    schedules {
      id
      dayOfWeek
      startTime
      endTime
      isAvailable
    }
  }
`

/**
 * Get all active stylists
 */
export const getAllStylists = cache(async function (): Promise<Stylist[]> {
  const GET_ALL_STYLISTS = gql`
    ${STYLIST_FRAGMENT}
    query GetAllStorefrontStylists {
      storefrontStylists {
        ...StorefrontStylistFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ storefrontStylists: Stylist[] }>(GET_ALL_STYLISTS)
    return data.storefrontStylists
  } catch (error) {
    console.error("Error fetching all stylists:", error)
    return []
  }
})

/**
 * Get a single stylist by ID
 */
export const getStylistById = cache(async function (id: string): Promise<Stylist | null> {
  const GET_STYLIST_BY_ID = gql`
    ${STYLIST_FRAGMENT}
    query GetStorefrontStylist($id: ID!) {
      storefrontStylist(id: $id) {
        ...StorefrontStylistFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ storefrontStylist: Stylist | null }>(GET_STYLIST_BY_ID, { id })
    return data.storefrontStylist
  } catch (error) {
    console.error("Error fetching stylist by id:", error)
    return null
  }
})

/**
 * Get featured stylists (limited number for homepage)
 */
export const getFeaturedStylists = cache(async function (limit: number = 4): Promise<Stylist[]> {
  const GET_FEATURED_STYLISTS = gql`
    ${STYLIST_FRAGMENT}
    query GetFeaturedStorefrontStylists($limit: Int!) {
      storefrontStylists(take: $limit) {
        ...StorefrontStylistFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ storefrontStylists: Stylist[] }>(GET_FEATURED_STYLISTS, { limit })
    return data.storefrontStylists
  } catch (error) {
    console.error("Error fetching featured stylists:", error)
    return []
  }
})

/**
 * Get stylists who can perform a specific service
 */
export const getStylistsForService = cache(async function (serviceId: string): Promise<BookingSelectionRead<Stylist>> {
  const GET_STYLISTS_FOR_SERVICE = gql`
    ${STYLIST_FRAGMENT}
    query GetStorefrontStylistsForService($serviceId: ID!) {
      storefrontStylists(serviceId: $serviceId) {
        ...StorefrontStylistFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ storefrontStylists?: unknown }>(GET_STYLISTS_FOR_SERVICE, { serviceId })
    return resolveBookingSelectionRead<Stylist>(true, data?.storefrontStylists, (item): item is Stylist => isQualifiedStylistSelection(item, serviceId))
  } catch (error) {
    console.error("Error fetching stylists for service:", error)
    return { status: "unavailable" }
  }
})