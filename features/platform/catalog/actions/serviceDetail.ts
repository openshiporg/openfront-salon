'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { dollarsToCents, fail, ok, type FormState } from '@/features/platform/lib/formState';

export interface ServiceDetail {
  id: string; name: string; description?: string | null; status?: string | null; price: number; baseDuration: number;
  depositRequired?: boolean | null; depositAmount?: number | null; requiresConsultation?: boolean | null; requiresPatchTest?: boolean | null;
  pricingTier?: Record<string, number> | null;
  category?: { name?: string | null } | null;
  image?: { imagePath?: string | null; image?: { url?: string | null } | null } | null;
  specialists: { id: string; tier?: string | null; role?: string | null; status?: string | null; user?: { name?: string | null } | null }[];
  requiredResources: { id: string; name?: string | null; type?: string | null; isActive?: boolean | null }[];
  reviews: { id: string; rating: number; comment?: string | null; createdAt?: string | null; isApproved?: boolean | null }[];
}

export async function getServiceDetail(id: string) {
  const now = new Date().toISOString();
  const response = await keystoneClient<{ service: ServiceDetail | null; upcoming: { id: string; startTime: string; client?: { displayName?: string | null } | null; stylist?: { user?: { name?: string | null } | null } | null; location?: { timezone?: string | null } | null }[]; upcomingCount: number; completedCount: number }>(`
    query ServiceDetail($id: ID!, $now: DateTime!) {
      service(where: { id: $id }) {
        id name description status price baseDuration depositRequired depositAmount requiresConsultation requiresPatchTest pricingTier
        category { name } image { imagePath image { url } }
        specialists { id tier role status user { name } }
        requiredResources { id name type isActive }
        reviews(orderBy: { createdAt: desc }, take: 20) { id rating comment createdAt isApproved }
      }
      upcoming: appointments(where: { services: { some: { id: { equals: $id } } }, status: { in: [pending, confirmed] }, startTime: { gte: $now } }, orderBy: { startTime: asc }, take: 6) {
        id startTime client { displayName } stylist { user { name } } location { timezone }
      }
      upcomingCount: appointmentsCount(where: { services: { some: { id: { equals: $id } } }, status: { in: [pending, confirmed] }, startTime: { gte: $now } })
      completedCount: appointmentsCount(where: { services: { some: { id: { equals: $id } } }, status: { equals: completed } })
    }
  `, { id, now });
  return response.success ? response.data : null;
}

/** Saves price-by-level through the audited catalog workflow; empty levels are removed. */
export async function savePricingTiers(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  const tiers: Record<string, number | null> = {};
  for (const tier of ['junior', 'senior', 'master', 'celebrity']) {
    const raw = String(formData.get(`tier.${tier}`) || '').trim();
    if (!raw) { tiers[tier] = null; continue; }
    const cents = dollarsToCents(raw);
    if (cents === null) return fail('Enter prices in dollars, for example 85.00.');
    tiers[tier] = cents;
  }
  const current = await keystoneClient<{ service: { name: string; description?: string | null; price: number; baseDuration: number; status?: string | null } | null }>(`
    query ServiceCore($id: ID!) { service(where: { id: $id }) { name description price baseDuration status } }
  `, { id });
  const service = current.success ? current.data.service : null;
  if (!service) return fail('Service not found.');
  const response = await keystoneClient<{ saveSalonRecord: { success: boolean; error?: string | null } }>(`
    mutation SavePricingTier($id: ID, $input: JSON!, $idempotencyKey: String!) { saveSalonRecord(kind: "service", id: $id, input: $input, idempotencyKey: $idempotencyKey) { success error } }
  `, { id, idempotencyKey: `service-tiers:${randomUUID()}`, input: { name: service.name, description: service.description || '', price: service.price, baseDuration: service.baseDuration, status: service.status === 'active' ? 'active' : 'inactive', pricingTier: tiers } });
  if (!response.success || !response.data.saveSalonRecord.success) return fail((response.success && response.data.saveSalonRecord.error) || 'Prices could not be saved.');
  revalidatePath(`/dashboard/platform/catalog/${id}`);
  revalidatePath(`/services/${id}`);
  return ok('Prices saved.');
}
