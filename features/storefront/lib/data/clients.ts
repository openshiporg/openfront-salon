"use server"

import { gql } from "graphql-request"
import { salonClient } from "../config"

export interface Client {
  id: string
  user: {
    id: string
    name: string
    email: string
  } | null
}

export interface CreateGuestClientInput {
  name: string
  email: string
  phone?: string
}

/**
 * Create a guest client for booking
 * This creates both a User and Client record
 */
export async function createGuestClient(input: CreateGuestClientInput): Promise<Client | null> {
  // First check if a client with this email already exists
  const existingClient = await getClientByEmail(input.email)
  if (existingClient) {
    return existingClient
  }

  const CREATE_USER_AND_CLIENT = gql`
    mutation CreateGuestClient($userData: UserCreateInput!, $clientData: ClientCreateInput!) {
      createUser(data: $userData) {
        id
        name
        email
      }
    }
  `

  const CREATE_CLIENT = gql`
    mutation CreateClient($data: ClientCreateInput!) {
      createClient(data: $data) {
        id
        user {
          id
          name
          email
        }
      }
    }
  `

  try {
    // Create user first
    const userResult = await salonClient.request<{ createUser: { id: string; name: string; email: string } }>(
      gql`
        mutation CreateUser($data: UserCreateInput!) {
          createUser(data: $data) {
            id
            name
            email
          }
        }
      `,
      {
        data: {
          name: input.name,
          email: input.email,
          password: `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`, // Random password for guest
        },
      }
    )

    // Then create client linked to user
    const clientResult = await salonClient.request<{ createClient: Client }>(CREATE_CLIENT, {
      data: {
        user: { connect: { id: userResult.createUser.id } },
        firstVisit: new Date().toISOString(),
        totalVisits: 0,
        lifetimeValue: 0,
      },
    })

    return clientResult.createClient
  } catch (error) {
    console.error("Error creating guest client:", error)
    return null
  }
}

/**
 * Get a client by their email address
 */
export async function getClientByEmail(email: string): Promise<Client | null> {
  const GET_CLIENT_BY_EMAIL = gql`
    query GetClientByEmail($email: String!) {
      clients(where: { user: { email: { equals: $email } } }, take: 1) {
        id
        user {
          id
          name
          email
        }
      }
    }
  `

  try {
    const data = await salonClient.request<{ clients: Client[] }>(GET_CLIENT_BY_EMAIL, { email })
    return data.clients[0] || null
  } catch (error) {
    console.error("Error fetching client by email:", error)
    return null
  }
}

/**
 * Update client information after a visit
 */
export async function updateClientAfterVisit(
  clientId: string,
  serviceTotal: number
): Promise<boolean> {
  const UPDATE_CLIENT = gql`
    mutation UpdateClientAfterVisit($id: ID!, $data: ClientUpdateInput!) {
      updateClient(where: { id: $id }, data: $data) {
        id
        totalVisits
        lifetimeValue
        lastVisit
      }
    }
  `

  try {
    // Get current client data
    const client = await salonClient.request<{ client: { totalVisits: number; lifetimeValue: number } | null }>(
      gql`
        query GetClient($id: ID!) {
          client(where: { id: $id }) {
            totalVisits
            lifetimeValue
          }
        }
      `,
      { id: clientId }
    )

    if (!client.client) return false

    await salonClient.request(UPDATE_CLIENT, {
      id: clientId,
      data: {
        totalVisits: (client.client.totalVisits || 0) + 1,
        lifetimeValue: (client.client.lifetimeValue || 0) + serviceTotal,
        lastVisit: new Date().toISOString(),
      },
    })

    return true
  } catch (error) {
    console.error("Error updating client after visit:", error)
    return false
  }
}
