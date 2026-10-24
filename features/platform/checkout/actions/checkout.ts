import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { loadShopTodayWhere } from '@/features/platform/lib/loadShopTodayWhere';
import {
  hasCompleteCheckoutAppointmentRead,
  resolveCheckoutAppointmentResponse,
  type CheckoutWorkflowReadResult,
} from '../lib/checkoutWorkflowRead';
import { resolveLocationStockResponse } from '../lib/locationStockRead';
import {
  resolveCheckoutMutationFeedback,
  type CheckoutMutationFeedback,
} from '../lib/checkoutMutationFeedback';

export interface CheckoutPackageBenefit {
  id: string;
  status?: string | null;
  totalValue?: number | null;
  usedValue?: number | null;
  expiresAt?: string | null;
  package?: {
    id: string;
    name?: string | null;
    services: { id: string; name?: string | null }[];
  } | null;
}

export interface CheckoutMembershipBenefit {
  id: string;
  status?: string | null;
  startDate?: string | null;
  pausedUntil?: string | null;
  membership?: {
    id: string;
    name?: string | null;
    isActive?: boolean | null;
    discountPercent?: number | null;
    includedServices: { id: string; name?: string | null }[];
  } | null;
}

export interface CheckoutRetailProduct {
  id: string;
  name?: string | null;
  sku?: string | null;
  price?: number | null;
  quantity?: number | null;
  localQuantity?: number;
  category?: string | null;
}

export interface CheckoutAppointment {
  id: string;
  startTime?: string | null;
  duration?: number | null;
  status?: string | null;
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  metadata?: unknown;
  location?: { id: string; name?: string | null; timezone?: string | null } | null;
  client?: {
    id: string;
    totalVisits?: number | null;
    lifetimeValue?: number | null;
    lastVisit?: string | null;
    user?: { id: string; name?: string | null; email?: string | null } | null;
  } | null;
  stylist?: {
    id: string;
    baseCommissionRate?: number | null;
    user?: { id: string; name?: string | null } | null;
  } | null;
  services: { id: string; name?: string | null; price?: number | null; basePrice?: number | null; baseDuration?: number | null }[];
  lineItems: {
    id: string;
    serviceTitle: string;
    serviceImagePath?: string | null;
    price?: number | null;
    quantity?: number | null;
    duration?: number | null;
    staff?: { id: string; baseCommissionRate?: number | null; user?: { name?: string | null } | null } | null;
    service?: { id: string; name?: string | null; price?: number | null; basePrice?: number | null } | null;
  }[];
  payment?: { id: string; subtotal?: number | null; totalAmount?: number | null; tip?: number | null; tax?: number | null; discount?: number | null; status?: string | null; paymentMethod?: string | null } | null;
  transaction?: { id: string; status?: string | null; paymentStatus?: string | null; paymentMethod?: string | null; lineItems?: { id: string; itemType?: string | null; quantity?: number | null; unitPrice?: number | null; discount?: number | null; service?: { name?: string | null } | null; product?: { name?: string | null } | null; staff?: { user?: { name?: string | null } | null } | null }[] } | null;
  clientPackages?: CheckoutPackageBenefit[];
  clientMemberships?: CheckoutMembershipBenefit[];
}

export interface CheckoutQueueData {
  appointments: CheckoutAppointment[];
  products: CheckoutRetailProduct[];
  counts: { ready: number; inProgress: number; completedToday: number; openTransactions: number };
}

export type CheckoutQueueLoadResult =
  | { status: 'available'; data: CheckoutQueueData }
  | { status: 'unavailable' };

interface CheckoutQueueQueryData {
  appointments: CheckoutAppointment[];
  products: CheckoutRetailProduct[];
  ready: number;
  inProgress: number;
  completedToday: number;
  openTransactions: number;
}

export function resolveCheckoutQueueResponse(response: {
  success: boolean;
  data?: CheckoutQueueQueryData;
  error?: string;
}): CheckoutQueueLoadResult {
  if (!response.success || !response.data) return { status: 'unavailable' };

  const data = response.data;
  const counts = [data.ready, data.inProgress, data.completedToday, data.openTransactions];
  if (
    !Array.isArray(data.appointments) ||
    !Array.isArray(data.products) ||
    counts.some((count) => typeof count !== 'number' || !Number.isFinite(count) || count < 0)
  ) return { status: 'unavailable' };

  return {
    status: 'available',
    data: {
      appointments: data.appointments,
      products: data.products,
      counts: {
        ready: data.ready,
        inProgress: data.inProgress,
        completedToday: data.completedToday,
        openTransactions: data.openTransactions,
      },
    },
  };
}

type CheckoutCreatedState = {
  transactionId?: string;
  paymentId?: string | null;
  createdLineItemIds: string[];
  updatedProducts: { id: string; previousQuantity: number }[];
  clientPackageId?: string;
  previousPackageUsedValue?: number | null;
  previousPackageStatus?: string | null;
  createdUsageId?: string;
  createdCommissionIds: string[];
  productSaleId?: string;
  appointmentId?: string;
  previousAppointmentStatus?: string | null;
  clientId?: string;
  previousTotalVisits?: number | null;
  previousLifetimeValue?: number | null;
  previousLastVisit?: string | null;
};

const CHECKOUT_APPOINTMENT_QUERY = `
  id
  startTime
  duration
  status
  depositAmount
  depositPaid
  metadata
  location { id name timezone }
  client {
    id
    totalVisits
    lifetimeValue
    lastVisit
    displayName
    guestEmail
    user { id name email }
  }
  stylist {
    id
    baseCommissionRate
    user { id name }
  }
  services {
    id
    name
    price
    basePrice
    baseDuration
  }
  lineItems {
    id
    serviceTitle
    serviceImagePath
    price
    quantity
    duration
    staff { id baseCommissionRate user { name } }
    service { id }
  }
  payment { id subtotal totalAmount tip tax discount status paymentMethod }
  transaction { id status paymentStatus paymentMethod lineItems { id itemType quantity unitPrice discount service { name } product { name } staff { user { name } } } }
`;

const CLIENT_PACKAGE_QUERY = `
  id
  status
  totalValue
  usedValue
  expiresAt
  package {
    id
    name
    services { id name }
  }
`;

const CLIENT_MEMBERSHIP_QUERY = `
  id
  status
  startDate
  pausedUntil
  membership {
    id
    name
    isActive
    discountPercent
    includedServices { id name }
  }
`;

export function calculateCheckoutTotals(appointment: CheckoutAppointment) {
  const rawLineItems = appointment.lineItems.length
    ? appointment.lineItems.map((item) => ({
        id: item.id,
        serviceId: item.service?.id,
        serviceName: item.serviceTitle,
        staffId: item.staff?.id || appointment.stylist?.id,
        staffName: item.staff?.user?.name || appointment.stylist?.user?.name || 'Unassigned',
        unitPrice: item.price || 0,
        quantity: item.quantity || 1,
        commissionRate: item.staff?.baseCommissionRate ?? appointment.stylist?.baseCommissionRate ?? 0,
      }))
    : appointment.services.map((service) => ({
        id: service.id,
        serviceId: service.id,
        serviceName: service.name || 'Service',
        staffId: appointment.stylist?.id,
        staffName: appointment.stylist?.user?.name || 'Unassigned',
        unitPrice: service.price || service.basePrice || 0,
        quantity: 1,
        commissionRate: appointment.stylist?.baseCommissionRate || 0,
      }));

  const subtotal = rawLineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxRate = Number.parseFloat(process.env.TAX_RATE || '0.08');
  const tax = Math.round(subtotal * taxRate);
  // This is deliberately a pre-adjustment estimate. Captured deposits, benefit
  // applications, retail, tips, and operator discounts are verified at checkout.
  const depositCredit = 0;
  const totalDue = subtotal + tax;
  const commissionEstimate = rawLineItems.reduce((sum, item) => sum + Math.round(item.unitPrice * item.quantity * (item.commissionRate || 0)), 0);

  return { lineItems: rawLineItems, subtotal, tax, depositCredit, totalDue, commissionEstimate };
}

export function getPackageRedemptionOptions(appointment: CheckoutAppointment) {
  const serviceIds = new Set(appointment.services.map((service) => service.id));
  const now = Date.now();
  return (appointment.clientPackages || [])
    .map((clientPackage) => {
      const remainingValue = Math.max(0, (clientPackage.totalValue || 0) - (clientPackage.usedValue || 0));
      const coveredServices = clientPackage.package?.services?.filter((service) => serviceIds.has(service.id)) || [];
      return { ...clientPackage, remainingValue, coveredServices };
    })
    .filter((clientPackage) => clientPackage.status === 'active' && clientPackage.remainingValue > 0 && clientPackage.coveredServices.length > 0 && (!clientPackage.expiresAt || Date.parse(clientPackage.expiresAt) > now));
}

export function getMembershipDiscountOptions(appointment: CheckoutAppointment) {
  const serviceIds = new Set(appointment.services.map((service) => service.id));
  const now = Date.now();
  return (appointment.clientMemberships || [])
    .map((clientMembership) => {
      const coveredServices = clientMembership.membership?.includedServices?.filter((service) => serviceIds.has(service.id)) || [];
      return { ...clientMembership, coveredServices };
    })
    .filter((clientMembership) => clientMembership.status === 'active' && clientMembership.membership?.isActive !== false && (!clientMembership.startDate || Date.parse(clientMembership.startDate) <= now) && (!clientMembership.pausedUntil || Date.parse(clientMembership.pausedUntil) <= now) && (clientMembership.membership?.discountPercent || 0) > 0);
}

function assertKeystoneSuccess<T>(response: { success: boolean; data?: T; error?: string }, label: string): asserts response is { success: true; data: T } {
  if (!response.success || response.data === undefined) {
    throw new Error(`${label}: ${response.error || 'Unknown Keystone error'}`);
  }
}

function normalizePaymentMethod(method?: string) {
  if (method === 'cash') return 'cash';
  if (method === 'card' || method === 'credit_card') return 'credit_card';
  if (method === 'debit_card') return 'debit_card';
  throw new Error('Only cash or an already-collected external terminal payment can be recorded.');
}

async function loadSelectedRetailItems(productIds: string[], quantities: number[]) {
  const requestedItems = productIds
    .map((productId, index) => ({ productId, quantity: Math.max(0, quantities[index] || 0) }))
    .filter((item) => item.productId && item.quantity > 0);

  if (requestedItems.length === 0) return [];

  const response = await keystoneClient<{ products: CheckoutRetailProduct[] }>(
    `
      query SelectedRetailProducts($ids: [ID!]!) {
        products(where: { id: { in: $ids }, isActive: { equals: true } }) {
          id
          name
          price
          quantity
          sku
        }
      }
    `,
    { ids: requestedItems.map((item) => item.productId) }
  );

  if (!response.success) {
    console.error('Failed to load selected retail products:', response.error);
    return [];
  }

  return requestedItems
    .map((requested) => {
      const product = response.data.products.find((candidate) => candidate.id === requested.productId);
      if (!product) return null;
      const quantity = Math.min(requested.quantity, product.quantity || 0);
      if (quantity <= 0) return null;
      return {
        productId: product.id,
        productName: product.name || 'Retail product',
        sku: product.sku,
        quantity,
        stockQuantity: product.quantity || 0,
        unitPrice: product.price || 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function attachClientBenefits(appointment: CheckoutAppointment, failClosed = false): Promise<CheckoutAppointment> {
  const userId = appointment.client?.user?.id;
  if (!userId) return appointment;

  const response = await keystoneClient<{
    clientPackages: CheckoutPackageBenefit[];
    clientMemberships: CheckoutMembershipBenefit[];
  }>(
    `
      query CheckoutClientBenefits($userId: ID!) {
        clientPackages(where: { client: { id: { equals: $userId } }, status: { equals: "active" } }, take: 20) {
          ${CLIENT_PACKAGE_QUERY}
        }
        clientMemberships(where: { client: { id: { equals: $userId } }, status: { equals: "active" } }, take: 20) {
          ${CLIENT_MEMBERSHIP_QUERY}
        }
      }
    `,
    { userId }
  );

  if (!response.success) {
    console.error('Failed to load checkout benefits:', response.error);
    if (failClosed) throw new Error('Checkout benefit data is unavailable');
    return appointment;
  }
  if (failClosed && (!Array.isArray(response.data.clientPackages) || !Array.isArray(response.data.clientMemberships))) {
    throw new Error('Checkout benefit data is incomplete');
  }

  return {
    ...appointment,
    clientPackages: response.data.clientPackages || [],
    clientMemberships: response.data.clientMemberships || [],
  };
}

export async function getCheckoutLocalStock(appointment: CheckoutAppointment, skip = 0, search = '') {
  const response = await keystoneClient<{ salonLocationStock?: unknown }>(`
    query CheckoutLocalStock($appointmentId: ID!, $skip: Int!, $search: String!) {
      salonLocationStock(appointmentId: $appointmentId, skip: $skip, take: 30, search: $search)
    }
  `, { appointmentId: appointment.id, skip, search });
  return resolveLocationStockResponse(response.success, response.success ? response.data?.salonLocationStock : null, appointment.location?.id || '');
}

export async function getCheckoutWorkflow(
  appointmentId: string,
): Promise<CheckoutWorkflowReadResult<CheckoutAppointment, CheckoutRetailProduct>> {
  const appointmentResponse = await keystoneClient<{ appointment: CheckoutAppointment | null }>(`
    query CheckoutWorkflowAppointment($id: ID!) {
      appointment(where: { id: $id }) { ${CHECKOUT_APPOINTMENT_QUERY} }
    }
  `, { id: appointmentId });
  const appointmentRead = resolveCheckoutAppointmentResponse(appointmentResponse);
  if (appointmentRead.status !== 'found') return appointmentRead;
  if (!hasCompleteCheckoutAppointmentRead(appointmentRead.appointment)) return { status: 'unavailable' };

  try {
    const appointment = await attachClientBenefits(appointmentRead.appointment, true);
    return { status: 'available', data: { appointment, products: [] } };
  } catch {
    console.error('Failed to load checkout workflow benefit data');
    return { status: 'unavailable' };
  }
}

export async function getCheckoutQueue(): Promise<CheckoutQueueLoadResult> {
  const todayWhere = await loadShopTodayWhere();
  if (!todayWhere) {
    console.error('Failed to load checkout shop-day scope');
    return { status: 'unavailable' };
  }

  const response = await keystoneClient<CheckoutQueueQueryData>(`
    query CheckoutQueue($todayWhere: AppointmentWhereInput!) {
      appointments(
        where: { AND: [{ status: { in: [confirmed, in_progress] } }, $todayWhere] }
        orderBy: { startTime: asc }
        take: 100
      ) {
        ${CHECKOUT_APPOINTMENT_QUERY}
      }
      ready: appointmentsCount(where: { AND: [{ status: { equals: confirmed } }, $todayWhere] })
      inProgress: appointmentsCount(where: { AND: [{ status: { equals: in_progress } }, $todayWhere] })
      completedToday: appointmentsCount(where: { AND: [{ status: { equals: completed } }, $todayWhere] })
      openTransactions: salonTransactionsCount(where: { status: { equals: open } })
    }
  `, { todayWhere });

  const queue = resolveCheckoutQueueResponse(response.success ? { ...response, data: { ...response.data, products: [] } } : response);
  if (queue.status === 'unavailable') {
    console.error('Failed to load checkout queue:', response.success ? 'Incomplete checkout queue response' : response.error);
    return queue;
  }

  try {
    const appointments = await Promise.all(queue.data.appointments.map((appointment) => attachClientBenefits(appointment, true)));
    return { status: 'available', data: { ...queue.data, appointments } };
  } catch {
    console.error('Failed to load checkout queue benefit data');
    return { status: 'unavailable' };
  }
}

export async function completeAppointmentCheckout(formData: FormData): Promise<CheckoutMutationFeedback> {
  'use server';

  const appointmentId = formData.get('appointmentId')?.toString();
  if (!appointmentId) return { status: 'failure' };
  const retailProductIds = formData.getAll('retailProductId').map((value) => value.toString());
  const retailQuantities = formData.getAll('retailQuantity').map((value) => Number(value || 0));
  const retailItems = retailProductIds
    .map((productId, index) => ({ productId, quantity: retailQuantities[index] || 0 }))
    .filter((item) => item.productId && item.quantity > 0);

  try {
    const response = await keystoneClient<{
      completeAppointmentCheckout: { success: boolean; transactionId?: string | null; paymentId?: string | null; error?: string | null };
    }>(`
      mutation ControlledCheckout($appointmentId: ID!, $paymentMethod: String!, $tipAmount: Int!, $discountAmount: Int!, $retailItems: JSON, $clientPackageId: ID, $clientMembershipId: ID, $idempotencyKey: String!) {
        completeAppointmentCheckout(
          appointmentId: $appointmentId, paymentMethod: $paymentMethod,
          tipAmount: $tipAmount, discountAmount: $discountAmount, retailItems: $retailItems,
          clientPackageId: $clientPackageId, clientMembershipId: $clientMembershipId,
          idempotencyKey: $idempotencyKey
        ) { success transactionId paymentId error }
      }
    `, {
      appointmentId,
      paymentMethod: normalizePaymentMethod(formData.get('paymentMethod')?.toString()),
      // The form takes dollars; the workflow stores cents.
      tipAmount: Math.round(Number(formData.get('tip') || 0) * 100),
      discountAmount: Math.round(Number(formData.get('discount') || 0) * 100),
      retailItems,
      clientPackageId: formData.get('clientPackageId')?.toString() || null,
      clientMembershipId: formData.get('clientMembershipId')?.toString() || null,
      idempotencyKey: `appointment-checkout:${appointmentId}`,
    });
    const feedback = resolveCheckoutMutationFeedback(response);

    if (feedback.status === 'failure') {
      console.error('Controlled checkout failed:', response.success ? response.data?.completeAppointmentCheckout?.error : response.error);
      return feedback;
    }

    revalidatePath('/dashboard/platform/checkout');
    revalidatePath(`/dashboard/platform/checkout/${appointmentId}`);
    revalidatePath(`/dashboard/platform/appointments/${appointmentId}`);
    revalidatePath('/dashboard/platform/appointments');
    revalidatePath('/dashboard/appointments');
    revalidatePath('/dashboard/salon-transactions');
    return feedback;
  } catch {
    console.error('Controlled checkout action failed');
    return { status: 'failure' };
  }
}
