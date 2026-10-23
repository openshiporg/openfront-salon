'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type ResourceStatus = 'all' | 'active' | 'inactive';

export interface PlatformResource {
  id: string;
  name?: string | null;
  type?: string | null;
  capacity?: number | null;
  isActive?: boolean | null;
  revision: number;
  notes?: string | null;
  location?: { id: string; name?: string | null; city?: string | null } | null;
  services: { id: string; name?: string | null; baseDuration?: number | null; requiresPatchTest?: boolean | null }[];
  appointments: {
    id: string;
    startTime?: string | null;
    endTime?: string | null;
    duration?: number | null;
    status?: string | null;
    client?: { displayName?: string | null } | null;
    location?: { timezone?: string | null } | null;
    stylist?: { user?: { name?: string | null } | null } | null;
    services: { name?: string | null }[];
  }[];
}

export interface ResourceOperationsData {
  resources: PlatformResource[];
  counts: {
    all: number;
    active: number;
    inactive: number;
    uncoveredServices: number;
  };
}

const RESOURCE_QUERY = `
  id
  name
  type
  capacity
  isActive
  revision
  notes
  location { id name city }
  services { id name baseDuration requiresPatchTest }
  appointments(
    where: { status: { in: [pending, confirmed, in_progress] } }
    orderBy: { startTime: asc }
    take: 8
  ) {
    id
    startTime
    endTime
    duration
    status
    client { displayName }
    location { timezone }
    stylist { user { name } }
    services { name }
  }
`;

function buildResourceWhere(status?: string | null) {
  if (status === 'active') return { isActive: { equals: true } };
  if (status === 'inactive') return { isActive: { equals: false } };
  return {};
}

export async function getResourceOperations(status?: string | null): Promise<ResourceOperationsData> {
  const response = await keystoneClient<{
    salonResources: PlatformResource[];
    allCount: number;
    activeCount: number;
    inactiveCount: number;
    uncoveredServices: { id: string }[];
  }>(
    `
      query ResourceOperations($where: SalonResourceWhereInput!) {
        salonResources(where: $where, orderBy: { name: asc }, take: 100) {
          ${RESOURCE_QUERY}
        }
        allCount: salonResourcesCount
        activeCount: salonResourcesCount(where: { isActive: { equals: true } })
        inactiveCount: salonResourcesCount(where: { isActive: { equals: false } })
        uncoveredServices: services(where: { requiredResources: { none: {} }, status: { equals: active } }, take: 200) {
          id
        }
      }
    `,
    { where: buildResourceWhere(status) }
  );

  if (!response.success) {
    console.error('Failed to load resource operations:', response.error);
    return { resources: [], counts: { all: 0, active: 0, inactive: 0, uncoveredServices: 0 } };
  }

  return {
    resources: response.data.salonResources || [],
    counts: {
      all: response.data.allCount || 0,
      active: response.data.activeCount || 0,
      inactive: response.data.inactiveCount || 0,
      uncoveredServices: response.data.uncoveredServices?.length || 0,
    },
  };
}

export async function setResourceActive(formData: FormData): Promise<void> {
  const id = formData.get('id')?.toString();
  const isActive = formData.get('isActive')?.toString() === 'true';
  const expectedRevision = Number(formData.get('revision'));

  if (!id || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    console.error('Missing resource id or revision.');
    return;
  }

  const response = await keystoneClient<{
    setSalonResourceAvailability: { success: boolean; error?: string | null };
  }>(
    `
      mutation SetSalonResourceAvailability($resourceId: ID!, $isActive: Boolean!, $expectedRevision: Int!) {
        setSalonResourceAvailability(resourceId: $resourceId, isActive: $isActive, expectedRevision: $expectedRevision) {
          success
          error
        }
      }
    `,
    { resourceId: id, isActive, expectedRevision }
  );

  if (!response.success || !response.data.setSalonResourceAvailability.success) {
    console.error(
      'Failed to update resource:',
      response.success ? response.data.setSalonResourceAvailability.error : response.error,
    );
    return;
  }

  revalidatePath('/dashboard/platform/resources');
  revalidatePath('/dashboard/salon-resources');
}
