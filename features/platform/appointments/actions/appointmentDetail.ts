'use server';

import { getPlatformActor } from '@/features/platform/lib/getPlatformActor';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type AppointmentDetail = {
  id: string;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;
  status?: string | null;
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  bookedAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
  internalNotes?: string | null;
  metadata?: unknown;
  location?: { id: string; name?: string | null; timezone?: string | null } | null;
  resource?: { id: string; name?: string | null; type?: string | null } | null;
  client?: { id: string; totalVisits?: number | null; lifetimeValue?: number | null; user?: { name?: string | null; email?: string | null; phone?: string | null } | null } | null;
  stylist?: { id: string; tier?: string | null; user?: { name?: string | null; email?: string | null } | null } | null;
  services: { id: string; name?: string | null; basePrice?: number | null; baseDuration?: number | null; requiresPatchTest?: boolean | null; requiresConsultation?: boolean | null }[];
  lineItems: { id: string; serviceTitle?: string | null; price?: number | null; quantity?: number | null; duration?: number | null; staff?: { user?: { name?: string | null } | null } | null; service?: { name?: string | null } | null }[];
};

type PaymentBoundary = {
  payments: { id: string; status?: string | null; paymentMethod?: string | null; subtotal?: number | null; tax?: number | null; tip?: number | null; discount?: number | null; totalAmount?: number | null; refundedAmount?: number | null; processedAt?: string | null; refundedAt?: string | null; receiptSent?: boolean | null; cardBrand?: string | null; cardLast4?: string | null }[];
  sessions: { id: string; status?: string | null; amount?: number | null; currency?: string | null; providerReference?: string | null; authorizedAt?: string | null; completedAt?: string | null; failedAt?: string | null }[];
  transactions: { id: string; status?: string | null; paymentStatus?: string | null; paymentMethod?: string | null; completedAt?: string | null; tip?: number | null; lineItems: { id: string; itemType?: string | null; quantity?: number | null; unitPrice?: number | null; discount?: number | null; service?: { name?: string | null } | null; product?: { name?: string | null } | null }[] }[];
};

type CommissionBoundary = { id: string; saleAmount?: number | null; commissionAmount?: number | null; commissionRate?: number | null; isPaid?: boolean | null; paidAt?: string | null; stylist?: { user?: { name?: string | null } | null } | null; service?: { name?: string | null } | null }[];
type InventoryBoundary = { id: string; type?: string | null; delta?: number | null; balanceBefore?: number | null; balanceAfter?: number | null; reason?: string | null; product?: { name?: string | null; sku?: string | null } | null }[];

export type AppointmentDetailData = {
  appointment: AppointmentDetail | null;
  paymentBoundary?: PaymentBoundary;
  commissions?: CommissionBoundary;
  inventory?: InventoryBoundary;
  capabilities: { appointments: boolean; payments: boolean; commissions: boolean; inventory: boolean; integrations: boolean };
};

const APPOINTMENT_DETAIL_QUERY = `
  id startTime endTime duration status depositAmount depositPaid bookedAt confirmedAt cancelledAt cancellationReason notes clientNotes internalNotes metadata
  location { id name timezone }
  resource { id name type }
  client { id totalVisits lifetimeValue user { name email phone } }
  stylist { id tier user { name email } }
  services { id name basePrice baseDuration requiresPatchTest requiresConsultation }
  lineItems { id serviceTitle price quantity duration staff { user { name } } service { name } }
`;

async function getBoundary<T>(query: string, variables: Record<string, unknown>, fallback: T): Promise<T> {
  const response = await keystoneClient<T>(query, variables);
  return response.success ? response.data : fallback;
}

export async function getAppointmentDetail(id: string): Promise<AppointmentDetailData> {
  const [appointmentResponse, authResponse] = await Promise.all([
    keystoneClient<{ appointment: AppointmentDetail | null }>(`query AppointmentDetail($id: ID!) { appointment(where: { id: $id }) { ${APPOINTMENT_DETAIL_QUERY} } }`, { id }),
    getPlatformActor(),
  ]);

  const role = authResponse.success ? authResponse.data?.authenticatedItem?.role : null;
  const manager = role?.canManageSalon === true;
  const capabilities = {
    appointments: manager || role?.canManageAppointments === true,
    payments: manager || role?.canManagePayments === true,
    commissions: manager || role?.canManageCommissions === true,
    inventory: manager || role?.canManageInventory === true || role?.canViewReports === true,
    integrations: manager || role?.canManageIntegrations === true,
  };
  const appointment = appointmentResponse.success ? appointmentResponse.data.appointment : null;
  if (!appointment) return { appointment: null, capabilities };

  const [paymentBoundary, commissions, inventory] = await Promise.all([
    capabilities.payments
      ? getBoundary<{ payments: PaymentBoundary['payments']; paymentSessions: PaymentBoundary['sessions']; salonTransactions: PaymentBoundary['transactions'] }>(`
          query AppointmentPaymentBoundary($id: ID!) {
            payments(where: { appointment: { id: { equals: $id } } }, take: 10, orderBy: { processedAt: desc }) { id status paymentMethod subtotal tax tip discount totalAmount refundedAmount processedAt refundedAt receiptSent cardBrand cardLast4 }
            paymentSessions(where: { appointment: { id: { equals: $id } } }, take: 20, orderBy: { createdAt: desc }) { id status amount currency providerReference authorizedAt completedAt failedAt }
            salonTransactions(where: { appointment: { id: { equals: $id } } }, take: 10, orderBy: { completedAt: desc }) { id status paymentStatus paymentMethod completedAt tip lineItems { id itemType quantity unitPrice discount service { name } product { name } } }
          }
        `, { id }, { payments: [], paymentSessions: [], salonTransactions: [] }).then((data) => ({ payments: data.payments, sessions: data.paymentSessions, transactions: data.salonTransactions }))
      : undefined,
    capabilities.commissions
      ? getBoundary<{ commissions: CommissionBoundary }>(`query AppointmentCommissions($id: ID!) { commissions(where: { payment: { appointment: { id: { equals: $id } } } }, take: 100, orderBy: { createdAt: desc }) { id saleAmount commissionAmount commissionRate isPaid paidAt stylist { user { name } } service { name } } }`, { id }, { commissions: [] }).then((data) => data.commissions)
      : undefined,
    capabilities.inventory
      ? getBoundary<{ inventoryMovements: InventoryBoundary }>(`query AppointmentInventory($id: ID!) { inventoryMovements(where: { appointment: { id: { equals: $id } } }, take: 100, orderBy: { createdAt: desc }) { id type delta balanceBefore balanceAfter reason product { name sku } } }`, { id }, { inventoryMovements: [] }).then((data) => data.inventoryMovements)
      : undefined,
  ]);

  return { appointment, paymentBoundary, commissions, inventory, capabilities };
}
