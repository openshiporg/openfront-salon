'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface StaffBookingService { id: string; name: string; baseDuration: number; price: number | null; category?: { name?: string | null } | null }
export interface StaffBookingClient { id: string; name: string; email: string; phone: string }
export interface StaffBookingData {
  services: StaffBookingService[];
  clients: StaffBookingClient[];
  locations: { id: string; name: string; timezone?: string | null }[];
}

/** Everything the front desk needs to book for a client, read with the operator's own access. */
export async function getStaffBookingData(): Promise<StaffBookingData | null> {
  const response = await keystoneClient<{
    services: StaffBookingService[];
    clients: Array<{ id: string; guestName?: string | null; guestEmail?: string | null; guestPhone?: string | null; user?: { name?: string | null; email?: string | null; phone?: string | null } | null }>;
    locations: StaffBookingData['locations'];
  }>(`
    query StaffBookingData {
      services(where: { status: { equals: active } }, orderBy: { name: asc }, take: 200) { id name baseDuration price category { name } }
      clients(orderBy: { updatedAt: desc }, take: 500) { id guestName guestEmail guestPhone user { name email phone } }
      locations(where: { isActive: { equals: true } }, take: 50) { id name timezone }
    }
  `);
  if (!response.success) return null;
  return {
    services: response.data.services || [],
    locations: response.data.locations || [],
    clients: (response.data.clients || []).flatMap((client) => {
      const email = client.user?.email || client.guestEmail || '';
      if (!email) return [];
      return [{ id: client.id, name: client.user?.name || client.guestName || email, email, phone: client.user?.phone || client.guestPhone || '' }];
    }),
  };
}
