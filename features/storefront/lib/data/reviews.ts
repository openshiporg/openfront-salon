"use server"

import { getBaseUrl } from "../getBaseUrl"

export interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  isApproved: boolean
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

const GRAPHQL_ENDPOINT = `${getBaseUrl()}/api/graphql`

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
        client {
          user {
            name
          }
        }
        service {
          id
          name
        }
        stylist {
          user {
            name
          }
        }
      }
    }
  `

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
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
        client {
          user {
            name
          }
        }
        stylist {
          user {
            name
          }
        }
      }
    }
  `

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
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
        client {
          user {
            name
          }
        }
        service {
          id
          name
        }
      }
    }
  `

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
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

export async function createReview(data: {
  rating: number
  comment?: string
  clientId: string
  serviceId?: string
  stylistId?: string
  appointmentId?: string
}): Promise<{ id: string } | null> {
  const mutation = `
    mutation CreateReview($data: ReviewCreateInput!) {
      createReview(data: $data) {
        id
      }
    }
  `

  const reviewData: any = {
    rating: data.rating,
    comment: data.comment || "",
    isApproved: false, // Requires manual approval
    client: { connect: { id: data.clientId } },
  }

  if (data.serviceId) {
    reviewData.service = { connect: { id: data.serviceId } }
  }

  if (data.stylistId) {
    reviewData.stylist = { connect: { id: data.stylistId } }
  }

  if (data.appointmentId) {
    reviewData.appointment = { connect: { id: data.appointmentId } }
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: mutation,
        variables: { data: reviewData }
      }),
    })

    const { data: result, errors } = await response.json()

    if (errors) {
      console.error("GraphQL errors:", errors)
      return null
    }

    return result?.createReview || null
  } catch (error) {
    console.error("Failed to create review:", error)
    return null
  }
}
