'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { dollarsToCents, fail, ok, operationKey, workflowState, type FormState } from '@/features/platform/lib/formState';

type Person = { id: string; user?: { name?: string | null } | null } | null;

export interface SaleLine {
  id: string; itemType: string; title?: string | null; quantity: number; unitPrice: number; discount?: number | null;
  service?: { name?: string | null } | null; product?: { name?: string | null } | null; staff?: Person;
  reversalLines: { quantity: number }[];
}
export interface SaleReversal {
  id: string; type: string; status: string; subtotalDelta: number; taxDelta: number; tipDelta: number; paymentDelta: number; commissionDelta: number;
  reason: string; postedAt?: string | null; actor?: { name?: string | null } | null;
}
export interface Sale {
  id: string; status: string; paymentStatus: string; paymentMethod?: string | null; completedAt?: string | null; tip?: number | null; metadata?: any;
  location?: { name?: string | null; timezone?: string | null } | null;
  client?: { id: string; displayName?: string | null } | null;
  staff?: Person;
  appointment?: {
    id: string; startTime?: string | null; metadata?: unknown;
    payment?: { id: string; status: string; subtotal: number; tax?: number | null; tip?: number | null; discount?: number | null; totalAmount: number; refundedAmount?: number | null; paymentMethod: string } | null;
  } | null;
  lineItems: SaleLine[];
  reversals: SaleReversal[];
}
export interface SaleCompensation {
  commissions: { id: string; commissionAmount: number; isPaid?: boolean | null; service?: { name?: string | null } | null; stylist?: Person; adjustments: { amountDelta: number }[] }[];
  tips: { id: string; amountDelta: number; type: string; payoutStatus: string; practitioner?: Person }[];
  stylists: { id: string; name: string }[];
}

const SALE_LIST = `
  id status paymentStatus paymentMethod completedAt tip metadata
  location { name timezone }
  client { id displayName }
  staff { id user { name } }
  appointment { id startTime metadata payment { id status subtotal tax tip discount totalAmount refundedAmount paymentMethod } }
  lineItems { id itemType title quantity unitPrice discount service { name } product { name } staff { id user { name } } reversalLines { quantity } }
  reversals(orderBy: { postedAt: desc }) { id type status subtotalDelta taxDelta tipDelta paymentDelta commissionDelta reason postedAt actor { name } }
`;

const statusWhere: Record<string, unknown> = {
  paid: { appointment: { payment: { status: { equals: 'completed' } } } },
  partial: { appointment: { payment: { status: { equals: 'partially_refunded' } } } },
  refunded: { appointment: { payment: { status: { equals: 'refunded' } } } },
  all: {},
};

export async function getSales(status: string, search: string) {
  const term = search.trim();
  const where = {
    status: { equals: 'completed' },
    ...(statusWhere[status] as object || {}),
    ...(term ? { OR: [
      { client: { guestName: { contains: term, mode: 'insensitive' } } },
      { client: { user: { name: { contains: term, mode: 'insensitive' } } } },
      { lineItems: { some: { title: { contains: term, mode: 'insensitive' } } } },
    ] } : {}),
  };
  const response = await keystoneClient<{ salonTransactions: Sale[]; paid: number; partial: number; refunded: number; all: number }>(`
    query Sales($where: SalonTransactionWhereInput!) {
      salonTransactions(where: $where, orderBy: { completedAt: desc }, take: 100) { ${SALE_LIST} }
      paid: salonTransactionsCount(where: { status: { equals: completed }, appointment: { payment: { status: { equals: "completed" } } } })
      partial: salonTransactionsCount(where: { status: { equals: completed }, appointment: { payment: { status: { equals: "partially_refunded" } } } })
      refunded: salonTransactionsCount(where: { status: { equals: completed }, appointment: { payment: { status: { equals: "refunded" } } } })
      all: salonTransactionsCount(where: { status: { equals: completed } })
    }
  `, { where });
  if (!response.success) return null;
  const { salonTransactions, ...counts } = response.data;
  return { sales: salonTransactions || [], counts };
}

export async function getSale(id: string): Promise<{ sale: Sale | null; compensation: SaleCompensation | null }> {
  const response = await keystoneClient<{ salonTransaction: Sale | null }>(`
    query Sale($id: ID!) { salonTransaction(where: { id: $id }) { ${SALE_LIST} } }
  `, { id });
  const sale = response.success ? response.data.salonTransaction : null;
  const paymentId = sale?.appointment?.payment?.id;
  if (!sale || !paymentId) return { sale, compensation: null };
  // Compensation reads need commission authority; the sale still loads without them.
  const comp = await keystoneClient<{ commissions: SaleCompensation['commissions']; gratuityLedgerEntries: SaleCompensation['tips']; stylists: { id: string; user?: { name?: string | null } | null }[] }>(`
    query SaleCompensation($paymentId: ID!) {
      commissions(where: { payment: { id: { equals: $paymentId } } }, take: 50) { id commissionAmount isPaid service { name } stylist { id user { name } } adjustments { amountDelta } }
      gratuityLedgerEntries(where: { payment: { id: { equals: $paymentId } } }, take: 50) { id amountDelta type payoutStatus practitioner { id user { name } } }
      stylists(where: { isActive: { equals: true } }, take: 100) { id user { name } }
    }
  `, { paymentId });
  return {
    sale,
    compensation: comp.success ? {
      commissions: comp.data.commissions || [],
      tips: comp.data.gratuityLedgerEntries || [],
      stylists: (comp.data.stylists || []).map((stylist) => ({ id: stylist.id, name: stylist.user?.name || 'Stylist' })),
    } : null,
  };
}

function refresh(id: string) {
  revalidatePath('/dashboard/platform/sales');
  revalidatePath(`/dashboard/platform/sales/${id}`);
  revalidatePath('/dashboard/platform/reports');
  revalidatePath('/dashboard/platform/commissions');
}

/** Full refund, void, or line-level partial refund through the conservation-checked reversal workflow. */
export async function reverseSale(_previous: FormState, formData: FormData): Promise<FormState> {
  const transactionId = String(formData.get('transactionId') || '');
  const mode = String(formData.get('mode') || 'refund');
  const reason = String(formData.get('reason') || '').trim();
  if (!transactionId) return fail('Sale not found.');
  if (!reason) return fail('Enter a reason.');
  const lines = formData.getAll('lineId').map(String).flatMap((lineItemId) => {
    const quantity = Number(formData.get(`quantity.${lineItemId}`) || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) return [];
    const disposition = String(formData.get(`disposition.${lineItemId}`) || 'not_applicable');
    return [{ lineItemId, quantity, inventoryDisposition: disposition }];
  });
  if (!lines.length) return fail('Choose at least one line to refund.');
  const tipCents = dollarsToCents(formData.get('tip') || '0');
  const packageCents = dollarsToCents(formData.get('restorePackage') || '0');
  if (tipCents === null || packageCents === null) return fail('Enter amounts in dollars, for example 12.50.');
  const type = mode === 'partial' ? 'partial_refund' : mode === 'void' ? 'void' : 'refund';
  const response = await keystoneClient<{ reverseSalonTransaction: { success: boolean; error?: string | null } }>(`
    mutation ReverseSale($transactionId: ID!, $type: String!, $lines: JSON!, $tipCents: Int!, $restorePackageCents: Int!, $reason: String!, $idempotencyKey: String!) {
      reverseSalonTransaction(transactionId: $transactionId, type: $type, lines: $lines, tipCents: $tipCents, restorePackageCents: $restorePackageCents, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { transactionId, type, lines, tipCents, restorePackageCents: packageCents, reason, idempotencyKey: String(formData.get('idempotencyKey') || operationKey('sale-reversal')) });
  const state = workflowState(response, 'reverseSalonTransaction', type === 'void' ? 'Sale voided.' : 'Refund posted.', 'The refund could not be posted. Check your refund access.');
  if (state.status === 'success') refresh(transactionId);
  return state;
}

/** Commission correction or a tip moved between stylists; never changes what the client paid. */
export async function adjustCompensation(_previous: FormState, formData: FormData): Promise<FormState> {
  const transactionId = String(formData.get('transactionId') || '');
  const commissionId = String(formData.get('commissionId') || '') || null;
  const direction = String(formData.get('direction') || 'decrease');
  const commissionCents = dollarsToCents(formData.get('commissionAmount') || '0');
  const tipCents = dollarsToCents(formData.get('tipAmount') || '0');
  const sourceGratuityEntryId = String(formData.get('sourceTipId') || '') || null;
  const targetPractitionerId = String(formData.get('targetStylistId') || '') || null;
  const reason = String(formData.get('reason') || '').trim();
  if (commissionCents === null || tipCents === null) return fail('Enter amounts in dollars, for example 12.50.');
  if (!reason) return fail('Enter a reason.');
  if (!commissionCents && !tipCents) return fail('Enter a commission change or a tip transfer.');
  const response = await keystoneClient<{ adjustSaleCompensation: { success: boolean; error?: string | null } }>(`
    mutation AdjustCompensation($transactionId: ID!, $commissionId: ID, $commissionDelta: Int!, $sourceGratuityEntryId: ID, $targetPractitionerId: ID, $gratuityTransferCents: Int!, $reason: String!, $idempotencyKey: String!) {
      adjustSaleCompensation(transactionId: $transactionId, commissionId: $commissionId, commissionDelta: $commissionDelta, sourceGratuityEntryId: $sourceGratuityEntryId, targetPractitionerId: $targetPractitionerId, gratuityTransferCents: $gratuityTransferCents, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, {
    transactionId, commissionId: commissionCents ? commissionId : null, commissionDelta: direction === 'increase' ? commissionCents : -commissionCents,
    sourceGratuityEntryId: tipCents ? sourceGratuityEntryId : null, targetPractitionerId: tipCents ? targetPractitionerId : null, gratuityTransferCents: tipCents,
    reason, idempotencyKey: operationKey('sale-compensation'),
  });
  const state = workflowState(response, 'adjustSaleCompensation', 'Adjustment posted.', 'The adjustment could not be posted. Check your commission access.');
  if (state.status === 'success') refresh(transactionId);
  return state;
}

