import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { buildShopTodayWhere, type ShopTodayLocation } from './shopToday';

export async function loadShopTodayWhere(now = new Date()) {
  const response = await keystoneClient<{ locations: ShopTodayLocation[] }>(`
    query ShopTodayLocations {
      locations { id timezone }
    }
  `);
  if (!response.success || !Array.isArray(response.data?.locations)) return null;

  try {
    return buildShopTodayWhere(response.data.locations, now);
  } catch {
    return null;
  }
}
