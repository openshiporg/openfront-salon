"use server"

import { gql } from "graphql-request"
import { cache } from "react"
import { salonClient } from "../config"

export interface GalleryImage {
  id: string
  image: {
    url: string
  } | null
  imagePath: string | null
  altText: string | null
  metadata: {
    placement?: string
    title?: string
    caption?: string
    serviceId?: string | null
  } | null
}

export const getGalleryImages = cache(async function (): Promise<GalleryImage[]> {
  const GET_GALLERY_IMAGES = gql`
    query GetStorefrontGalleryImages {
      salonImages(orderBy: { imagePath: asc }, take: 100) {
        id
        image {
          url
        }
        imagePath
        altText
        metadata: publicMetadata
      }
    }
  `

  try {
    const data = await salonClient.request<{ salonImages: GalleryImage[] }>(GET_GALLERY_IMAGES)
    return data.salonImages.filter((image) => image.metadata?.placement === "gallery")
  } catch (error) {
    console.error("Error fetching gallery images:", error)
    return []
  }
})
