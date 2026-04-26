"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"
import { cache } from "react"

export interface Service {
  id: string
  name: string
  description: string | null
  baseDuration: number
  basePrice: number
  pricingTier: Record<string, number> | null
  requiresConsultation: boolean
  requiresPatchTest: boolean
  category: {
    id: string
    name: string
  } | null
  image: {
    image: {
      url: string
    } | null
    altText: string | null
  } | null
  specialists: {
    id: string
    tier: string | null
    bio: string | null
    user: {
      name: string
    } | null
    photo: {
      image: {
        url: string
      } | null
      altText: string | null
    } | null
  }[]
}

export interface ServiceCategory {
  id: string
  name: string
  description: string | null
  services: Service[]
}

/**
 * Get all services grouped by category
 */
export const getServicesGroupedByCategory = cache(async function (): Promise<ServiceCategory[]> {
  const GET_SERVICES_BY_CATEGORY = gql`
    query GetServicesByCategory {
      serviceCategories(orderBy: { name: asc }) {
        id
        name
        description
        services(orderBy: { name: asc }) {
          id
          name
          description
          baseDuration
          basePrice
          pricingTier
          requiresConsultation
          requiresPatchTest
          image {
            image {
              url
            }
            altText
          }
          specialists {
            id
            tier
            bio
            user {
              name
            }
            photo {
              image {
                url
              }
              altText
            }
          }
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ serviceCategories: ServiceCategory[] }>(GET_SERVICES_BY_CATEGORY)
    return data.serviceCategories
  } catch (error) {
    console.error("Error fetching services by category:", error)
    return []
  }
})

/**
 * Get all services
 */
export const getAllServices = cache(async function (): Promise<Service[]> {
  const GET_ALL_SERVICES = gql`
    query GetAllServices {
      services(orderBy: { name: asc }) {
        id
        name
        description
        baseDuration
        basePrice
        pricingTier
        requiresConsultation
        requiresPatchTest
        category {
          id
          name
        }
        image {
          image {
            url
          }
          altText
        }
        specialists {
          id
          tier
          bio
          user {
            name
          }
          photo {
            image {
              url
            }
            altText
          }
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ services: Service[] }>(GET_ALL_SERVICES)
    return data.services
  } catch (error) {
    console.error("Error fetching all services:", error)
    return []
  }
})

/**
 * Get a single service by ID
 */
export const getServiceById = cache(async function (id: string): Promise<Service | null> {
  const GET_SERVICE_BY_ID = gql`
    query GetServiceById($id: ID!) {
      service(where: { id: $id }) {
        id
        name
        description
        baseDuration
        basePrice
        pricingTier
        requiresConsultation
        requiresPatchTest
        category {
          id
          name
        }
        image {
          image {
            url
          }
          altText
        }
        specialists {
          id
          tier
          bio
          user {
            name
          }
          photo {
            image {
              url
            }
            altText
          }
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ service: Service | null }>(GET_SERVICE_BY_ID, { id })
    return data.service
  } catch (error) {
    console.error("Error fetching service by id:", error)
    return null
  }
})

/**
 * Get featured services (limited number for homepage)
 */
export const getFeaturedServices = cache(async function (limit: number = 4): Promise<Service[]> {
  const GET_FEATURED_SERVICES = gql`
    query GetFeaturedServices($limit: Int!) {
      services(take: $limit, orderBy: { basePrice: desc }) {
        id
        name
        description
        baseDuration
        basePrice
        category {
          id
          name
        }
        image {
          image {
            url
          }
          altText
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ services: Service[] }>(GET_FEATURED_SERVICES, { limit })
    return data.services
  } catch (error) {
    console.error("Error fetching featured services:", error)
    return []
  }
})
