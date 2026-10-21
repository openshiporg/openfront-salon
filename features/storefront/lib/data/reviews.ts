"use server"

import { getGraphQLEndpoint } from "../getBaseUrl"

export interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  isApproved: boolean
  reviewerName?: string | null
  stylistName?: string | null
  client?: {
    user?: {
      name: string
    }
  }
  service?: {
    id: string
    name: string
  }
  stylist?: {
    id: string
    user?: {
      name: string
    }
  }
}

export async function getApprovedReviews(limit?: number): Promise<Review[]> {
  const query = `
    query GetApprovedReviews($limit: Int) {
      reviews(
        where: { isApproved: { equals: true } }
        orderBy: { createdAt: desc }
        take: $limit
      ) {
        id
        rating
        comment
        createdAt
        reviewerName
        service {
          id
          name
        }
        stylistName
      }
    }
  `

  try {
    const response = await fetch(await getGraphQLEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { limit } }),
      cache: "no-store",
    })

    const { data, errors } = await response.json()

    if (errors) {
      console.error("GraphQL errors:", errors)
      return []
    }

    return data?.reviews || []
  } catch (error) {
    console.error("Failed to fetch reviews:", error)
    return []
  }
}

export async function getReviewsForService(serviceId: string): Promise<Review[]> {
  const query = `
    query GetServiceReviews($serviceId: ID!) {
      reviews(
        where: {
          isApproved: { equals: true }
          service: { id: { equals: $serviceId } }
        }
        orderBy: { createdAt: desc }
      ) {
        id
        rating
        comment
        createdAt
        reviewerName
        stylistName
      }
    }
  `

  try {
    const response = await fetch(await getGraphQLEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { serviceId } }),
      cache: "no-store",
    })

    const { data, errors } = await response.json()

    if (errors) {
      console.error("GraphQL errors:", errors)
      return []
    }

    return data?.reviews || []
  } catch (error) {
    console.error("Failed to fetch service reviews:", error)
    return []
  }
}

export async function getReviewsForStylist(stylistId: string): Promise<Review[]> {
  const query = `
    query GetStylistReviews($stylistId: ID!) {
      reviews(
        where: {
          isApproved: { equals: true }
          stylist: { id: { equals: $stylistId } }
        }
        orderBy: { createdAt: desc }
      ) {
        id
        rating
        comment
        createdAt
        reviewerName
        service {
          id
          name
        }
      }
    }
  `

  try {
    const response = await fetch(await getGraphQLEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { stylistId } }),
      cache: "no-store",
    })

    const { data, errors } = await response.json()

    if (errors) {
      console.error("GraphQL errors:", errors)
      return []
    }

    return data?.reviews || []
  } catch (error) {
    console.error("Failed to fetch stylist reviews:", error)
    return []
  }
}

export async function getAverageRatingForService(serviceId: string): Promise<number> {
  const reviews = await getReviewsForService(serviceId)
  if (reviews.length === 0) return 0

  const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
  return sum / reviews.length
}

export async function getAverageRatingForStylist(stylistId: string): Promise<number> {
  const reviews = await getReviewsForStylist(stylistId)
  if (reviews.length === 0) return 0

  const sum = reviews.reduce((acc, review) => acc + review.rating, 0)
  return sum / reviews.length
}
