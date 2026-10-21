'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PlatformPermission } from './navigation';

export type PlatformActor = {
  id: string;
  role: Partial<Record<PlatformPermission | 'canAccessDashboard', boolean>> | null;
};

export async function getPlatformActor() {
  return keystoneClient<{ authenticatedItem: PlatformActor | null }>(`
    query PlatformActor {
      authenticatedItem {
        ... on User {
          id
          role {
            canAccessDashboard canManageSalon canManageAppointments canManageClients canManageCatalog
            canManageSchedules canManageOwnSchedule canManageResources canManageInventory canManagePayments
            canManageCommissions canViewReports canManageIntegrations canManageOnboarding
          }
        }
      }
    }
  `);
}
