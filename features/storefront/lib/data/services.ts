"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"
import { cache } from "react"
import { getStylistsForService } from "./stylists"
import { isBookableServiceSelection, resolveBookingSelectionRead, type BookingSelectionRead } from "./bookingSelectionRead"

export interface StorefrontImage {
  image: {
    url: string
  } | null
  imagePath: string | null
  altText: string | null
}

export interface Service {
  id: string
  name: string
  description: string | null
  status: string
  baseDuration: number
  basePrice: number
  pricingTier: Record<string, number> | null
  requiresConsultation: boolean
  requiresPatchTest: boolean
  category: {
    id: string
    name: string
  } | null
  image: StorefrontImage | null
  specialists: {
    id: string
    tier: string | null
    role?: string | null
    bio: string | null
    user: {
      name: string
    } | null
    photo: StorefrontImage | null
  }[]
}

export interface ServiceCategory {
  id: string
  name: string
  description: string | null
  services: Service[]
}

/** Stored prices are cents; the storefront formats dollars. Price-by-level uses the same unit. */
function toStorefrontService(service: Service): Service {
  const pricingTier = service.pricingTier && typeof service.pricingTier === "object"
    ? Object.fromEntries(Object.entries(service.pricingTier).filter(([, cents]) => typeof cents === "number").map(([tier, cents]) => [tier, (cents as number) / 100]))
    : service.pricingTier
  return { ...service, basePrice: service.basePrice / 100, pricingTier }
}

const SERVICE_FIELDS = gql`
  fragment StorefrontServiceFields on Service {
    id
    name
    description
    status
    baseDuration
    basePrice: price
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
      imagePath
      altText
    }
    specialists(take: 10) {
      id
      tier
      role
      bio
      user {
        name
      }
      photo {
        image {
          url
        }
        imagePath
        altText
      }
    }
  }
`

/**
 * Get all services grouped by category.
 * Uncategorized live services are kept visible until onboarding creates real
 * category rows for them.
 */
export const getServicesGroupedByCategory = cache(async function (): Promise<ServiceCategory[]> {
  const GET_SERVICES_BY_CATEGORY = gql`
    ${SERVICE_FIELDS}
    query GetServicesByCategory {
      serviceCategories(take: 20, orderBy: { name: asc }) {
        id
        name
        description
        services(where: { status: { equals: active }, requiresConsultation: { equals: false }, requiresPatchTest: { equals: false } }, take: 100, orderBy: { name: asc }) {
          ...StorefrontServiceFields
        }
      }
      uncategorizedServices: services(where: { category: null, status: { equals: active }, requiresConsultation: { equals: false }, requiresPatchTest: { equals: false } }, take: 100, orderBy: { name: asc }) {
        ...StorefrontServiceFields
      }
    }
  `

  try {
    const data = await salonClient.request<{
      serviceCategories: ServiceCategory[]
      uncategorizedServices: Service[]
    }>(GET_SERVICES_BY_CATEGORY)
    const categories = data.serviceCategories
      .filter((category) => category.services.length > 0)
      .map((category) => ({ ...category, services: category.services.map(toStorefrontService) }))

    if (data.uncategorizedServices.length > 0) {
      categories.push({
        id: "signature-services",
        name: "Signature services",
        description: "Appointment-ready services from the live salon catalog.",
        services: data.uncategorizedServices.map(toStorefrontService),
      })
    }

    return categories
  } catch (error) {
    console.error("Error fetching services by category:", error)
    return []
  }
})

/** Get all services. */
export const getAllServices = cache(async function (): Promise<BookingSelectionRead<Service>> {
  const GET_ALL_SERVICES = gql`
    ${SERVICE_FIELDS}
    query GetAllServices {
      services(where: { status: { equals: active }, requiresConsultation: { equals: false }, requiresPatchTest: { equals: false } }, take: 100, orderBy: { name: asc }) {
        ...StorefrontServiceFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ services?: unknown }>(GET_ALL_SERVICES)
    const result = resolveBookingSelectionRead<Service>(true, data?.services, (item): item is Service => isBookableServiceSelection(item))
    return result.status === "available"
      ? { status: "available", items: result.items.map(toStorefrontService) }
      : result
  } catch (error) {
    console.error("Error fetching all services:", error)
    return { status: "unavailable" }
  }
})

/** Get a single service by ID. */
export const getServiceById = cache(async function (id: string): Promise<Service | null> {
  const GET_SERVICE_BY_ID = gql`
    ${SERVICE_FIELDS}
    query GetServiceById($id: ID!) {
      service(where: { id: $id }) {
        ...StorefrontServiceFields
      }
    }
  `

  try {
    const [data, qualified] = await Promise.all([
      salonClient.request<{ service: Service | null }>(GET_SERVICE_BY_ID, { id }),
      getStylistsForService(id),
    ]);
    const service = data.service;
    // Public display-only staff projection; never broaden User list access for names.
    return service && service.status === "active" && !service.requiresConsultation && !service.requiresPatchTest
      ? toStorefrontService({ ...service, specialists: qualified.status === "available" ? qualified.items : [] }) : null
  } catch (error) {
    console.error("Error fetching service by id:", error)
    return null
  }
})

/** Get featured services for the homepage. */
export const getFeaturedServices = cache(async function (limit: number = 4): Promise<Service[]> {
  const GET_FEATURED_SERVICES = gql`
    ${SERVICE_FIELDS}
    query GetFeaturedServices($limit: Int!) {
      services(where: { status: { equals: active }, requiresConsultation: { equals: false }, requiresPatchTest: { equals: false } }, take: $limit, orderBy: { price: desc }) {
        ...StorefrontServiceFields
      }
    }
  `

  try {
    const data = await salonClient.request<{ services: Service[] }>(GET_FEATURED_SERVICES, { limit })
    return data.services.map(toStorefrontService)
  } catch (error) {
    console.error("Error fetching featured services:", error)
    return []
  }
})
