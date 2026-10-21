"use server"

import { gql } from "graphql-request"
import { cache } from "react"
import { salonClient } from "../config"
import { safeStorefrontHue } from "@/features/lib/storefront-theme"
import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo"
import { normalizeStoreLogoColor, storeLogoHue } from "@/features/lib/store-logo"
import {
  UNCONFIGURED_STOREFRONT_DESCRIPTION,
  UNCONFIGURED_STOREFRONT_TITLE,
} from "./brand-constants"

export type LocationHours = Record<
  string,
  { open?: string | null; close?: string | null; closed?: boolean | null }
>

interface PublicStorefrontSettingsRecord {
  logoIcon: string
  logoColor: string
  configured: boolean
  name: string | null
  description: string | null
  themeHue: number
  primaryLocation: {
    id: string
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    phone: string | null
    email: string | null
    hours: LocationHours | null
    timezone: string | null
  } | null
}

export interface StorefrontBrand {
  logoIcon: string
  logoColor: string
  configured: boolean
  name: string | null
  description: string | null
  themeHue: number
  locationId: string | null
  locationName: string | null
  address: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  phone: string | null
  phoneHref: string | null
  email: string | null
  hours: LocationHours | null
  timezone: string | null
}

function clean(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function phoneHref(phone: string | null): string | null {
  if (!phone) return null
  const normalized = phone.replace(/[^\d+]/g, "")
  return normalized ? `tel:${normalized}` : null
}

function unconfiguredBrand(): StorefrontBrand {
  return {
    configured: false,
    logoIcon: "",
    logoColor: "0",
    name: null,
    description: null,
    themeHue: 0,
    locationId: null,
    locationName: null,
    address: null,
    addressLine: null,
    city: null,
    state: null,
    zipCode: null,
    phone: null,
    phoneHref: null,
    email: null,
    hours: null,
    timezone: null,
  }
}

export const getStorefrontBrand = cache(async function (): Promise<StorefrontBrand> {
  try {
    const data = await salonClient.request<{ publicStorefrontSettings: PublicStorefrontSettingsRecord }>(gql`
      query PublicStorefrontSettings {
        publicStorefrontSettings {
          configured
          name
          description
          themeHue logoIcon logoColor
          primaryLocation {
            id name address city state zipCode phone email hours timezone
          }
        }
      }
    `)
    const settings = data.publicStorefrontSettings
    const location = settings.primaryLocation
    const name = clean(settings.name)
    if (!settings.configured || !name || !location?.id) return unconfiguredBrand()

    const address = clean(location.address)
    const city = clean(location.city)
    const state = clean(location.state)
    const zipCode = clean(location.zipCode)
    const locality = [city, state].filter(Boolean).join(", ")
    const finalLine = [locality, zipCode].filter(Boolean).join(" ")
    const phone = clean(location.phone)

    return {
      configured: true,
      logoIcon: sanitizeStoreLogoSvg(settings.logoIcon || ""),
      logoColor: normalizeStoreLogoColor(settings.logoColor),
      name,
      description: clean(settings.description),
      themeHue: storeLogoHue(settings.logoColor),
      locationId: location.id,
      locationName: clean(location.name),
      address,
      addressLine: [address, finalLine].filter(Boolean).join(", ") || null,
      city,
      state,
      zipCode,
      phone,
      phoneHref: phoneHref(phone),
      email: clean(location.email),
      hours: location.hours || null,
      timezone: clean(location.timezone),
    }
  } catch (error) {
    console.error("Error fetching public storefront settings:", error)
    return unconfiguredBrand()
  }
})

export async function storefrontTitle(page?: string): Promise<string> {
  const brand = await getStorefrontBrand()
  if (page && brand.name) return `${page} | ${brand.name}`
  return page || brand.name || UNCONFIGURED_STOREFRONT_TITLE
}

export async function storefrontDescription(): Promise<string> {
  const brand = await getStorefrontBrand()
  return brand.description || UNCONFIGURED_STOREFRONT_DESCRIPTION
}
