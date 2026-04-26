"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"
import { cache } from "react"

export interface Stylist {
  id: string
  tier: "junior" | "senior" | "master" | "celebrity"
  bio: string | null
  commissionRate: number
  certifications: string | null
  hireDate: string | null
  isActive: boolean
  user: {
    id: string
    name: string
    email: string
  } | null
  photo: {
    image: {
      url: string
    } | null
    altText: string | null
  } | null
  specializations: {
    id: string
    name: string
  }[]
  schedules: {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    isAvailable: boolean
  }[]
}

/**
 * Get all active stylists
 */
export const getAllStylists = cache(async function (): Promise<Stylist[]> {
  const GET_ALL_STYLISTS = gql`
    query GetAllStylists {
      stylists(
        where: { isActive: { equals: true } }
        orderBy: { tier: desc }
      ) {
        id
        tier
        bio
        commissionRate
        certifications
        hireDate
        isActive
        user {
          id
          name
          email
        }
        photo {
          image {
            url
          }
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
    }
  `

  try {
    const data = await salonClient.request<{ stylists: Stylist[] }>(GET_ALL_STYLISTS)
    return data.stylists
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
    query GetStylistById($id: ID!) {
      stylist(where: { id: $id }) {
        id
        tier
        bio
        commissionRate
        certifications
        hireDate
        isActive
        user {
          id
          name
          email
        }
        photo {
          image {
            url
          }
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
    }
  `

  try {
    const data = await salonClient.request<{ stylist: Stylist | null }>(GET_STYLIST_BY_ID, { id })
    return data.stylist
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
    query GetFeaturedStylists($limit: Int!) {
      stylists(
        where: { isActive: { equals: true } }
        take: $limit
        orderBy: { tier: desc }
      ) {
        id
        tier
        bio
        hireDate
        user {
          id
          name
        }
        photo {
          image {
            url
          }
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
    }
  `

  try {
    const data = await salonClient.request<{ stylists: Stylist[] }>(GET_FEATURED_STYLISTS, { limit })
    return data.stylists
  } catch (error) {
    console.error("Error fetching featured stylists:", error)
    return []
  }
})

/**
 * Get stylists who can perform a specific service
 */
export const getStylistsForService = cache(async function (serviceId: string): Promise<Stylist[]> {
  const GET_STYLISTS_FOR_SERVICE = gql`
    query GetStylistsForService($serviceId: ID!) {
      stylists(
        where: {
          isActive: { equals: true }
          specializations: { some: { id: { equals: $serviceId } } }
        }
        orderBy: { tier: desc }
      ) {
        id
        tier
        bio
        user {
          id
          name
        }
        photo {
          image {
            url
          }
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
    }
  `

  try {
    const data = await salonClient.request<{ stylists: Stylist[] }>(GET_STYLISTS_FOR_SERVICE, { serviceId })
    return data.stylists
  } catch (error) {
    console.error("Error fetching stylists for service:", error)
    return []
  }
})

