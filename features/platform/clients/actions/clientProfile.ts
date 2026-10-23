'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface ClientProfile {
  id: string;
  displayName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  totalVisits?: number | null;
  lifetimeValue?: number | null;
  firstVisit?: string | null;
  lastVisit?: string | null;
  allergies?: string | null;
  skinSensitivities?: string | null;
  hairType?: string | null;
  hairTexture?: string | null;
  notes?: string | null;
  marketingConsent?: boolean | null;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  preferredStylist?: { id: string; user?: { name?: string | null } | null } | null;
  homeLocation?: { name?: string | null } | null;
  appointments: Array<{
    id: string; startTime?: string | null; status?: string | null; duration?: number | null;
    location?: { timezone?: string | null } | null;
    stylist?: { user?: { name?: string | null } | null } | null;
    services: { name?: string | null }[];
    payment?: { totalAmount?: number | null; status?: string | null } | null;
  }>;
  colorFormulas: Array<{ id: string; formulaName?: string | null; products?: string | null; measurements?: string | null; processingTime?: number | null; result?: string | null; createdAt?: string | null; stylist?: { user?: { name?: string | null } | null } | null }>;
}
export interface ClientCareNote { id: string; content?: string | null; createdAt?: string | null; author?: { name?: string | null } | null }

export async function getClientProfile(id: string): Promise<{ client: ClientProfile | null; notes: ClientCareNote[] | null; stylists: { id: string; name: string }[] }> {
  const response = await keystoneClient<{ client: ClientProfile | null; stylists: Array<{ id: string; user?: { name?: string | null } | null }> }>(`
    query ClientProfile($id: ID!) {
      client(where: { id: $id }) {
        id displayName guestEmail guestPhone totalVisits lifetimeValue firstVisit lastVisit marketingConsent
        user { name email phone }
        preferredStylist { id user { name } }
        homeLocation { name }
        appointments(orderBy: { startTime: desc }, take: 50) {
          id startTime status duration location { timezone } stylist { user { name } } services { name } payment { totalAmount status }
        }
      }
      stylists(where: { isActive: { equals: true } }, take: 100) { id user { name } }
    }
  `, { id });
  if (!response.success || !response.data.client) return { client: null, notes: null, stylists: [] };
  // Care records need their own permission; a reader without it still gets the visit history.
  const care = await keystoneClient<{ client: Pick<ClientProfile, 'allergies' | 'skinSensitivities' | 'hairType' | 'hairTexture' | 'notes' | 'colorFormulas'> | null; clientNotes: ClientCareNote[] }>(`
    query ClientCare($id: ID!) {
      client(where: { id: $id }) {
        allergies skinSensitivities hairType hairTexture notes
        colorFormulas(orderBy: { createdAt: desc }, take: 50) { id formulaName products measurements processingTime result createdAt stylist { user { name } } }
      }
      clientNotes(where: { client: { id: { equals: $id } } }, orderBy: { createdAt: desc }, take: 50) { id content createdAt author { name } }
    }
  `, { id });
  const client = { ...response.data.client, colorFormulas: [], ...(care.success && care.data.client ? care.data.client : {}) } as ClientProfile;
  return {
    client,
    notes: care.success ? care.data.clientNotes || [] : null,
    stylists: (response.data.stylists || []).map((stylist) => ({ id: stylist.id, name: stylist.user?.name || 'Stylist' })),
  };
}

export type CareFormState = { status: 'idle' | 'success' | 'error'; message: string };

export async function addClientNote(_previous: CareFormState, formData: FormData): Promise<CareFormState> {
  const clientId = String(formData.get('clientId') || '');
  const content = String(formData.get('content') || '').trim();
  if (!clientId || !content) return { status: 'error', message: 'Write a note first.' };
  if (content.length > 5000) return { status: 'error', message: 'Notes are limited to 5,000 characters.' };
  const response = await keystoneClient(`
    mutation AddClientNote($data: ClientNoteCreateInput!) { createClientNote(data: $data) { id } }
  `, { data: { client: { connect: { id: clientId } }, content, isPrivate: true } });
  if (!response.success) return { status: 'error', message: 'The note could not be saved. Check your care-record access.' };
  revalidatePath(`/dashboard/platform/clients/${clientId}`);
  return { status: 'success', message: 'Note added.' };
}

export async function addColorFormula(_previous: CareFormState, formData: FormData): Promise<CareFormState> {
  const clientId = String(formData.get('clientId') || '');
  const text = (key: string, max: number) => String(formData.get(key) || '').trim().slice(0, max);
  const formulaName = text('formulaName', 200);
  if (!clientId || !formulaName) return { status: 'error', message: 'Name the formula.' };
  const minutes = Number(formData.get('processingTime') || 0);
  const stylistId = text('stylistId', 100);
  const response = await keystoneClient(`
    mutation AddColorFormula($data: ColorFormulaCreateInput!) { createColorFormula(data: $data) { id } }
  `, { data: {
    formulaName,
    products: text('products', 5000),
    measurements: text('measurements', 5000),
    processingTime: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
    result: text('result', 5000),
    client: { connect: { id: clientId } },
    ...(stylistId ? { stylist: { connect: { id: stylistId } } } : {}),
  } });
  if (!response.success) return { status: 'error', message: 'The formula could not be saved. Check your care-record access.' };
  revalidatePath(`/dashboard/platform/clients/${clientId}`);
  return { status: 'success', message: 'Formula saved.' };
}
