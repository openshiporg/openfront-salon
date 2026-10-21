'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { normalizeStoreLogoColor, storeLogoHue } from '@/features/lib/store-logo';

export interface PlatformStoreSettings {
  id: string;
  name: string;
  description?: string | null;
  themeHue: number;
  logoIcon: string;
  logoColor: string;
  primaryLocation?: { id: string; name: string } | null;
}

export interface StoreSettingsLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface StoreSettingsData {
  settings: PlatformStoreSettings | null;
  locations: StoreSettingsLocation[];
}

export type SaveStoreSettingsState =
  | { status: 'idle'; message: null }
  | { status: 'success' | 'error'; message: string };

export async function getPlatformStoreSettings(): Promise<StoreSettingsData> {
  const response = await keystoneClient<{
    storeSettings: PlatformStoreSettings | null;
    locations: StoreSettingsLocation[];
  }>(`
    query PlatformStoreSettings {
      storeSettings {
        id name description themeHue logoIcon logoColor
        primaryLocation { id name }
      }
      locations(
        where: { isActive: { equals: true } }
        orderBy: { name: asc }
        take: 50
      ) {
        id name address city state zipCode
      }
    }
  `);
  if (!response.success) throw new Error(response.error || 'Unable to load storefront settings');
  return {
    settings: response.data.storeSettings || null,
    locations: response.data.locations || [],
  };
}

export async function savePlatformStoreSettings(
  _previous: SaveStoreSettingsState,
  formData: FormData,
): Promise<SaveStoreSettingsState> {
  try {
    const name = formData.get('name')?.toString().trim() || '';
    const description = formData.get('description')?.toString().trim() || '';
    const primaryLocationId = formData.get('primaryLocationId')?.toString() || '';
    const rawLogo = formData.get('logoIcon')?.toString() || '';
    const logoIcon = sanitizeStoreLogoSvg(rawLogo);
    if (rawLogo && !logoIcon) throw new Error('Logo must be a valid, safe SVG document');
    const logoColor = normalizeStoreLogoColor(formData.get('logoColor'));
    const themeHue = storeLogoHue(logoColor);

    if (!name || name.length > 120) throw new Error('Storefront name must be between 1 and 120 characters');
    if (description.length > 240) throw new Error('Description must be 240 characters or fewer');
    if (!primaryLocationId) throw new Error('Choose an active primary location');

    const response = await keystoneClient<{
      upsertSalonStoreSettings: { id: string; name: string; themeHue: number; primaryLocationId: string };
    }>(`
      mutation UpsertSalonStoreSettings(
        $name: String!
        $description: String
        $themeHue: Int!
        $primaryLocationId: ID!
        $logoIcon: String
        $logoColor: String
      ) {
        upsertSalonStoreSettings(
          name: $name
          description: $description
          themeHue: $themeHue
          primaryLocationId: $primaryLocationId
          logoIcon: $logoIcon
          logoColor: $logoColor
        ) {
          id name themeHue primaryLocationId
        }
      }
    `, { name, description: description || null, themeHue, primaryLocationId, logoIcon, logoColor });

    if (!response.success) throw new Error(response.error || 'Unable to save storefront settings');
    revalidatePath('/dashboard/platform/store-settings');
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Storefront settings saved.' };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Unable to save storefront settings' };
  }
}
