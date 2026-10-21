import { zonedDateKey, zonedDayWindow } from '@/features/keystone/scheduling/availability';

export interface ShopTodayLocation {
  id: string;
  timezone?: string | null;
}

export function shopDayRange(now: Date, timezone?: string | null) {
  const zone = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
  const dateKey = zonedDateKey(now, zone);
  const { start, end } = zonedDayWindow(dateKey, zone);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildShopTodayWhere(locations: readonly ShopTodayLocation[], now: Date) {
  const shopRanges = locations.map((location) => {
    if (!location || typeof location.id !== 'string' || !location.id) throw new Error('Shop location scope is incomplete');
    const range = shopDayRange(now, location.timezone);
    return {
      location: { id: { equals: location.id } },
      startTime: { gte: range.start, lt: range.end },
    };
  });
  const unassignedRange = shopDayRange(now, 'UTC');
  return {
    OR: [
      ...shopRanges,
      { location: null, startTime: { gte: unassignedRange.start, lt: unassignedRange.end } },
    ],
  };
}
