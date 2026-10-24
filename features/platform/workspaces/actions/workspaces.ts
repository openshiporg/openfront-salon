'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { type InventoryIntent, type InventoryAcknowledgement } from '../lib/inventoryIntent';
import { executeInventoryIntent } from '../lib/executeInventoryIntent';
import type { MovementReceipt } from '@/features/keystone/inventory/movementReceipt';

export type SalonManagementKind = 'client' | 'staff' | 'location' | 'resource' | 'product' | 'service' | 'category';
export interface SalonManagementOption { id: string; name: string; isActive?: boolean | null; status?: string | null; user?: { name?: string | null } | null }
export interface SalonManagementRecord {
  id: string; name?: string | null; isActive?: boolean | null; status?: string | null;
  address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null; phone?: string | null; email?: string | null;
  slug?: string | null; sku?: string | null; type?: string | null; capacity?: number | null; price?: number | null; basePrice?: number | null;
  cost?: number | null; reorderPoint?: number | null; description?: string | null; category?: string | { id: string; name?: string | null } | null;
  baseDuration?: number | null; tier?: string | null; role?: string | null; baseCommissionRate?: number | null; commissionRate?: number | null;
  displayOrder?: number | null; sortOrder?: number | null; isVisible?: boolean | null; timezone?: string | null;
  guestName?: string | null; guestEmail?: string | null; guestPhone?: string | null;
  hours?: Record<string, { open?: string | null; close?: string | null; closed?: boolean }> | null;
  user?: { id?: string; name?: string | null; email?: string | null; phone?: string | null } | null;
  homeLocation?: { id: string } | null; location?: { id: string; name?: string | null } | null;
  locations?: SalonManagementOption[]; specializations?: SalonManagementOption[]; specialists?: SalonManagementOption[];
  requiredResources?: SalonManagementOption[];
}
export interface SalonManagementData {
  records: SalonManagementRecord[]; locations: SalonManagementOption[]; services: SalonManagementOption[];
  resources: SalonManagementOption[]; stylists: SalonManagementOption[]; categories: SalonManagementOption[];
  canManageCompensation: boolean;
}

const workspaceSections = ['clients', 'catalog', 'benefits', 'inventory', 'engagement', 'administration', 'reports', 'integrations'] as const;
export type WorkspaceSection = typeof workspaceSections[number];
export interface WorkspaceMetric { label: string; value: number; format: 'money' | 'count' | string }
export interface WorkspaceRecord { id: string; title: string; subtitle?: string | null; status?: string | null; detail?: string | null; amount?: number | null; metric?: number | null; occurredAt?: string | null; href?: string | null; action?: string | null }
export interface WorkspaceData { actorId?: string | null; section: WorkspaceSection; title: string; description: string; attentionCount: number; attentionLabel?: string | null; metrics: WorkspaceMetric[]; records: WorkspaceRecord[] }

export async function getSalonWorkspace(section: WorkspaceSection, range?: string): Promise<WorkspaceData> {
  if (!workspaceSections.includes(section)) throw new Error('Unsupported salon workspace');
  const response = await keystoneClient<{ salonOperationsWorkspace: WorkspaceData }>(`
    query SalonOperationsWorkspace($section: String!, $range: String) {
      salonOperationsWorkspace(section: $section, range: $range) {
        actorId section title description attentionCount attentionLabel
        metrics { label value format }
        records { id title subtitle status detail amount metric occurredAt href action }
      }
    }
  `, { section, range: range || null });
  if (!response.success) throw new Error(response.error || 'Unable to load salon operations');
  return response.data.salonOperationsWorkspace;
}

export async function adjustInventoryFromWorkspace(formData: FormData): Promise<void> {
  const productId = formData.get('productId')?.toString() || '';
  const locationId = formData.get('locationId')?.toString() || '';
  const delta = Number(formData.get('delta'));
  const reason = formData.get('reason')?.toString().trim() || '';
  const idempotencyKey = formData.get('idempotencyKey')?.toString() || '';
  if (!productId || !locationId || !Number.isInteger(delta) || delta === 0 || !reason || idempotencyKey.length < 12 || idempotencyKey.length > 200) {
    throw new Error('Product, location, quantity change, reason, and operation key are required.');
  }
  const response = await keystoneClient<{ adjustSalonInventory: { success: boolean; error?: string | null } }>(`
    mutation AdjustSalonInventory($productId: ID!, $locationId: ID!, $delta: Int!, $reason: String!, $idempotencyKey: String!) {
      adjustSalonInventory(productId: $productId, locationId: $locationId, delta: $delta, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { productId, locationId, delta, reason, idempotencyKey });
  if (!response.success || !response.data.adjustSalonInventory.success) throw new Error(response.success ? response.data.adjustSalonInventory.error || 'Inventory adjustment failed' : response.error);
  revalidatePath('/dashboard/platform/inventory');
}

export async function adjustSavedInventoryIntent(input: InventoryIntent): Promise<InventoryAcknowledgement> {
  const result = await executeInventoryIntent(input, {
    currentActor: async () => {
      const actor = await keystoneClient<{ authenticatedItem?: { id?: string } | null }>(`query InventoryIntentActor { authenticatedItem { ... on User { id } } }`);
      return actor.success ? actor.data.authenticatedItem?.id || null : null;
    },
    adjust: async (intent) => {
      const response = await keystoneClient<{ adjustSalonInventory?: unknown }>(`
        mutation AdjustSavedInventory($productId: ID!, $locationId: ID!, $delta: Int!, $reason: String!, $idempotencyKey: String!) {
          adjustSalonInventory(productId: $productId, locationId: $locationId, delta: $delta, reason: $reason, idempotencyKey: $idempotencyKey) { success movementId balanceAfter }
        }
      `, { productId: intent.productId, locationId: intent.locationId, delta: intent.delta, reason: intent.reason, idempotencyKey: intent.idempotencyKey });
      return response.success ? response.data.adjustSalonInventory : null;
    },
    originalMovement: async (movementId) => {
      const response = await keystoneClient<{ inventoryMovement?: MovementReceipt | null }>(`
        query OriginalInventoryReceipt($id: ID!) {
          inventoryMovement(where: { id: $id }) { id idempotencyKey type delta balanceBefore balanceAfter reason metadata product { id } location { id } appointment { id } }
        }
      `, { id: movementId });
      return response.success ? response.data.inventoryMovement || null : null;
    },
  });
  if (result.status === 'acknowledged') revalidatePath('/dashboard/platform/inventory');
  return result;
}

export async function getSalonManagementWorkspace(kind: SalonManagementKind): Promise<SalonManagementData> {
  const allowed: SalonManagementKind[] = ['client', 'staff', 'location', 'resource', 'product', 'service', 'category'];
  if (!allowed.includes(kind)) throw new Error('Unsupported salon management workspace.');
  const response = await keystoneClient<{ salonManagementWorkspace: SalonManagementData }>(`
    query SalonManagementWorkspace($kind: String!) { salonManagementWorkspace(kind: $kind) }
  `, { kind });
  if (!response.success) throw new Error(response.error || 'Unable to load salon records.');
  return response.data.salonManagementWorkspace;
}

function formText(formData: FormData, key: string) { return formData.get(key)?.toString().trim() || ''; }
function formBoolean(formData: FormData, key: string) { return formData.get(key) === 'true' || formData.get(key) === 'on'; }
function formInteger(formData: FormData, key: string, fallback = 0) {
  const value = formData.get(key);
  return value === null || value === '' ? fallback : Number(value);
}

export async function saveSalonRecordFromWorkspace(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const kind = formText(formData, 'kind') as SalonManagementKind;
  const id = formText(formData, 'recordId') || null;
  const idempotencyKey = formText(formData, 'idempotencyKey');
  const input: Record<string, unknown> = {};
  const setText = (...keys: string[]) => keys.forEach(key => { input[key] = formText(formData, key); });
  const setInteger = (...keys: string[]) => keys.forEach(key => { input[key] = formInteger(formData, key); });
  const setBoolean = (key: string) => { if (formData.has(`${key}Present`)) input[key] = formBoolean(formData, key); };
  switch (kind) {
    case 'client': setText('name', 'email', 'phone'); input.homeLocationId = formText(formData, 'homeLocationId') || null; break;
    case 'staff': setText('name', 'email', 'phone', 'tier', 'role', 'status'); input.locationIds = formData.getAll('locationIds').map(String); input.serviceIds = formData.getAll('serviceIds').map(String); { const rate = formData.get('baseCommissionRate'); if (rate !== null && rate !== '') input.baseCommissionRate = Number(rate); } break;
    case 'location': {
      setText('name', 'address', 'city', 'state', 'zipCode', 'phone', 'email', 'timezone');
      input.hours = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
        const closed = formBoolean(formData, `hours.${day}.closed`);
        return [day, closed ? { closed: true, open: null, close: null } : { closed: false, open: formText(formData, `hours.${day}.open`), close: formText(formData, `hours.${day}.close`) }];
      }));
      setBoolean('isActive'); break;
    }
    case 'resource': setText('name', 'type'); setInteger('capacity'); input.locationId = formText(formData, 'locationId'); setBoolean('isActive'); break;
    case 'product': setText('name', 'sku', 'category', 'description'); setInteger('price', 'cost', 'reorderPoint'); setBoolean('isActive'); break;
    case 'service': setText('name', 'description', 'status'); setInteger('price', 'baseDuration'); input.categoryId = formText(formData, 'categoryId') || null; input.specialistIds = formData.getAll('specialistIds').map(String); input.resourceIds = formData.getAll('resourceIds').map(String); break;
    case 'category': setText('name', 'slug', 'description'); setInteger('displayOrder'); setBoolean('isVisible'); break;
    default: return { success: false, error: 'Unsupported salon record type.' };
  }
  if (idempotencyKey.length < 12 || idempotencyKey.length > 160) return { success: false, error: 'Refresh this page and retry the operation.' };
  const response = await keystoneClient<{ saveSalonRecord: { success: boolean; recordId: string | null; error?: string | null } }>(`
    mutation SaveSalonRecord($kind: String!, $id: ID, $input: JSON!, $idempotencyKey: String!) {
      saveSalonRecord(kind: $kind, id: $id, input: $input, idempotencyKey: $idempotencyKey) { success recordId error }
    }
  `, { kind, id, input, idempotencyKey });
  if (!response.success) return { success: false, error: 'Salon record could not be saved. Check your access and try again.' };
  if (!response.data.saveSalonRecord.success) return { success: false, error: response.data.saveSalonRecord.error || 'Salon record could not be saved.' };
  for (const path of ['/dashboard/platform/clients', '/dashboard/platform/catalog', '/dashboard/platform/administration', '/dashboard/platform/inventory', '/dashboard/platform/resources', '/dashboard/platform/schedules']) revalidatePath(path);
  return { success: true };
}

export async function transitionWaitlistFromWorkspace(formData: FormData): Promise<void> {
  const waitlistEntryId = formData.get('waitlistEntryId')?.toString() || '';
  const action = formData.get('action')?.toString() || '';
  const reason = formData.get('reason')?.toString().trim() || '';
  if (!waitlistEntryId || !['notify', 'remove'].includes(action)) throw new Error('Unsupported waitlist action.');
  const response = await keystoneClient<{ transitionWaitlistEntry: { success: boolean; error?: string | null } }>(`
    mutation TransitionWaitlist($waitlistEntryId: ID!, $action: String!, $reason: String) {
      transitionWaitlistEntry(waitlistEntryId: $waitlistEntryId, action: $action, reason: $reason) { success error }
    }
  `, { waitlistEntryId, action, reason: reason || null });
  if (!response.success || !response.data.transitionWaitlistEntry.success) throw new Error(response.success ? response.data.transitionWaitlistEntry.error || 'Waitlist action failed' : response.error);
  revalidatePath('/dashboard/platform/engagement');
}
