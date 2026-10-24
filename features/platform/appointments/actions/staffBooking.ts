'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface StaffBookingService { id: string; name: string; baseDuration: number; price: number | null; category?: { name?: string | null } | null }
export interface StaffBookingClient { id: string; userId: string | null; name: string; email: string; phone: string }
export interface StaffBookingData {
  services: StaffBookingService[];
  clients: StaffBookingClient[];
  locations: { id: string; name: string; timezone?: string | null }[];
}

/** Everything the front desk needs to book for a client, read with the operator's own access. */
export async function getStaffBookingData(): Promise<StaffBookingData | null> {
  const response = await keystoneClient<{
    services: StaffBookingService[];
    clients: Array<{ id: string; guestName?: string | null; guestEmail?: string | null; guestPhone?: string | null; user?: { id: string; name?: string | null; email?: string | null; phone?: string | null } | null }>;
    locations: StaffBookingData['locations'];
  }>(`
    query StaffBookingData {
      services(where: { status: { equals: active } }, orderBy: { name: asc }, take: 200) { id name baseDuration price category { name } }
      clients(orderBy: { updatedAt: desc }, take: 500) { id guestName guestEmail guestPhone user { id name email phone } }
      locations(where: { isActive: { equals: true } }, take: 50) { id name timezone }
    }
  `);
  if (!response.success) return null;
  return {
    services: response.data.services || [],
    locations: response.data.locations || [],
    clients: (response.data.clients || []).flatMap((client) => {
      const email = client.user?.email || client.guestEmail || '';
      const phone = client.user?.phone || client.guestPhone || '';
      const name = client.user?.name || client.guestName || email || phone;
      if (!name) return [];
      return [{ id: client.id, userId: client.user?.id || null, name, email, phone }];
    }),
  };
}

export type StaffBookingInput = {
  clientId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientNotes?: string;
  serviceId: string;
  stylistId: string;
  locationId: string;
  startTime: string;
  requestKey: string;
  waitlistEntryId?: string;
};

export type StaffBookingResult =
  | { status: 'accepted'; appointmentId: string; waitlistError?: string | null }
  | { status: 'rejected'; error: string }
  | { status: 'unresolved' };

/** Books through the operator path; email is optional and an existing Client is connected by id. */
export async function bookForClient(input: StaffBookingInput): Promise<StaffBookingResult> {
  const response = await keystoneClient<{ bookAppointment: { success: boolean; appointmentId?: string | null; error?: string | null } }>(`
    mutation StaffBookAppointment($serviceIds: [ID!]!, $stylistId: ID!, $startTime: String!, $clientName: String!, $clientEmail: String!, $clientPhone: String, $clientNotes: String, $clientId: ID, $locationId: ID, $requestKey: String) {
      bookAppointment(serviceIds: $serviceIds, stylistId: $stylistId, startTime: $startTime, clientName: $clientName, clientEmail: $clientEmail, clientPhone: $clientPhone, clientNotes: $clientNotes, clientId: $clientId, locationId: $locationId, requestKey: $requestKey) {
        success appointmentId error
      }
    }
  `, {
    serviceIds: [input.serviceId],
    stylistId: input.stylistId,
    startTime: input.startTime,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone || null,
    clientNotes: input.clientNotes || null,
    clientId: input.clientId || null,
    locationId: input.locationId,
    requestKey: input.requestKey,
  });
  if (!response.success) return { status: 'unresolved' };
  const result = response.data.bookAppointment;
  if (!result?.success || !result.appointmentId) return result?.error ? { status: 'rejected', error: result.error } : { status: 'unresolved' };

  let waitlistError: string | null = null;
  if (input.waitlistEntryId) {
    const converted = await keystoneClient<{ transitionWaitlistEntry: { success: boolean; error?: string | null } }>(`
      mutation ConvertWaitlistEntry($id: ID!, $appointmentId: ID!) {
        transitionWaitlistEntry(waitlistEntryId: $id, action: "convert", appointmentId: $appointmentId, reason: "Booked by staff") { success error }
      }
    `, { id: input.waitlistEntryId, appointmentId: result.appointmentId });
    if (!converted.success || !converted.data.transitionWaitlistEntry.success) {
      waitlistError = (converted.success && converted.data.transitionWaitlistEntry.error) || 'The waitlist entry could not be closed.';
    }
  }
  revalidatePath('/dashboard/platform/appointments');
  revalidatePath('/dashboard/platform/waitlist');
  return { status: 'accepted', appointmentId: result.appointmentId, waitlistError };
}
