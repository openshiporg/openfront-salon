'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface PlatformCommission {
  id: string;
  saleAmount?: number | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  isPaid?: boolean | null;
  paidAt?: string | null;
  createdAt?: string | null;
  notes?: string | null;
  stylist?: {
    id: string;
    user?: { name?: string | null; email?: string | null } | null;
  } | null;
  service?: { id: string; name?: string | null } | null;
  payment?: {
    id: string;
    totalAmount?: number | null;
    paymentMethod?: string | null;
    processedAt?: string | null;
    appointment?: {
      id: string;
      startTime?: string | null;
      metadata?: unknown;
      location?: { timezone?: string | null } | null;
      client?: { displayName?: string | null } | null;
    } | null;
  } | null;
}

export interface StylistCommissionSummary {
  stylistId: string;
  stylistName: string;
  unpaidCount: number;
  unpaidAmount: number;
  paidAmount: number;
  grossSales: number;
  tipsOwed: number;
}

export interface CommissionOperationsData {
  commissions: PlatformCommission[];
  summaries: StylistCommissionSummary[];
  counts: { unpaid: number; paid: number; total: number };
  totals: { unpaidAmount: number; paidAmount: number; grossSales: number; tipsOwed: number; tipsPaid: number };
}

const COMMISSION_QUERY = `
  id
  saleAmount
  commissionRate
  commissionAmount
  isPaid
  paidAt
  createdAt
  notes
  stylist { id user { name email } }
  service { id name }
  payment {
    id
    totalAmount
    paymentMethod
    processedAt
    appointment { id startTime metadata location { timezone } client { displayName } }
  }
`;

function buildWhere(status?: string | null) {
  if (status === 'paid') return { isPaid: { equals: true } };
  if (status === 'all') return {};
  return { isPaid: { equals: false } };
}

type Ledger = {
  commissions: Array<{ isPaid?: boolean | null; commissionAmount?: number | null; saleAmount?: number | null; stylist?: { id: string; user?: { name?: string | null } | null } | null }>;
  tips: Array<{ amountDelta?: number | null; payoutStatus?: string | null; payment?: { paymentMethod?: string | null } | null; practitioner?: { id: string; user?: { name?: string | null } | null } | null }>;
};

/** Per-stylist payout from the whole ledger, so totals never depend on the selected tab. */
function summarize({ commissions, tips }: Ledger): StylistCommissionSummary[] {
  const summaries = new Map<string, StylistCommissionSummary>();
  const entry = (id: string | undefined, name: string | null | undefined) => {
    const stylistId = id || 'unassigned';
    const current = summaries.get(stylistId) || { stylistId, stylistName: name || 'Unassigned', unpaidCount: 0, unpaidAmount: 0, paidAmount: 0, grossSales: 0, tipsOwed: 0 };
    summaries.set(stylistId, current);
    return current;
  };

  for (const commission of commissions) {
    const current = entry(commission.stylist?.id, commission.stylist?.user?.name);
    current.grossSales += commission.saleAmount || 0;
    if (commission.isPaid) current.paidAmount += commission.commissionAmount || 0;
    else {
      current.unpaidCount += 1;
      current.unpaidAmount += commission.commissionAmount || 0;
    }
  }
  for (const tip of tips) {
    if (tip.payoutStatus !== 'payable') continue;
    entry(tip.practitioner?.id, tip.practitioner?.user?.name).tipsOwed += tip.amountDelta || 0;
  }

  return [...summaries.values()].sort((a, b) => (b.unpaidAmount + b.tipsOwed) - (a.unpaidAmount + a.tipsOwed));
}

export async function getCommissionOperations(status?: string | null): Promise<CommissionOperationsData> {
  const response = await keystoneClient<{
    commissions: PlatformCommission[];
    ledger: Ledger['commissions'];
    tips: Ledger['tips'];
    unpaidCount: number;
    paidCount: number;
    totalCount: number;
  }>(
    `
      query CommissionOperations($where: CommissionWhereInput!) {
        commissions(where: $where, orderBy: { createdAt: desc }, take: 200) {
          ${COMMISSION_QUERY}
        }
        ledger: commissions(take: 5000) { isPaid commissionAmount saleAmount stylist { id user { name } } }
        tips: gratuityLedgerEntries(where: { type: { equals: allocation } }, take: 5000) { amountDelta payoutStatus payment { paymentMethod } practitioner { id user { name } } }
        unpaidCount: commissionsCount(where: { isPaid: { equals: false } })
        paidCount: commissionsCount(where: { isPaid: { equals: true } })
        totalCount: commissionsCount
      }
    `,
    { where: buildWhere(status) }
  );

  if (!response.success) {
    console.error('Failed to load commission operations:', response.error);
    return {
      commissions: [],
      summaries: [],
      counts: { unpaid: 0, paid: 0, total: 0 },
      totals: { unpaidAmount: 0, paidAmount: 0, grossSales: 0, tipsOwed: 0, tipsPaid: 0 },
    };
  }

  // Cash tips go to the stylist at the chair, so only terminal (card) tips belong to payroll.
  const ledger = { commissions: response.data.ledger || [], tips: (response.data.tips || []).filter((tip) => tip.payment?.paymentMethod !== 'cash') };
  const summaries = summarize(ledger);
  const totals = summaries.reduce(
    (acc, summary) => {
      acc.unpaidAmount += summary.unpaidAmount;
      acc.paidAmount += summary.paidAmount;
      acc.grossSales += summary.grossSales;
      acc.tipsOwed += summary.tipsOwed;
      return acc;
    },
    { unpaidAmount: 0, paidAmount: 0, grossSales: 0, tipsOwed: 0, tipsPaid: ledger.tips.filter((tip) => tip.payoutStatus === 'paid').reduce((sum, tip) => sum + (tip.amountDelta || 0), 0) }
  );

  return {
    commissions: response.data.commissions || [],
    summaries,
    counts: {
      unpaid: response.data.unpaidCount || 0,
      paid: response.data.paidCount || 0,
      total: response.data.totalCount || 0,
    },
    totals,
  };
}

async function runCommissionPayout(commissionIds: string[], reference?: string) {
  const response = await keystoneClient<{
    payoutCommissions: { success: boolean; payoutCount: number; totalAmount: number; error?: string | null };
  }>(
    `
      mutation PayoutCommissions($commissionIds: [ID!]!, $reference: String) {
        payoutCommissions(commissionIds: $commissionIds, reference: $reference) {
          success
          payoutCount
          totalAmount
          error
        }
      }
    `,
    { commissionIds, reference: reference || null },
  );

  if (!response.success || !response.data.payoutCommissions.success) {
    console.error(
      'Failed to pay commissions:',
      response.success ? response.data.payoutCommissions.error : response.error,
    );
    return false;
  }

  revalidatePath('/dashboard/platform/commissions');
  revalidatePath('/dashboard/commissions');
  return true;
}

export async function markCommissionPaid(formData: FormData): Promise<void> {
  const id = formData.get('id')?.toString();
  if (!id) {
    console.error('Missing commission id.');
    return;
  }
  await runCommissionPayout([id], formData.get('reference')?.toString());
}

export async function markStylistCommissionsPaid(formData: FormData): Promise<void> {
  const stylistId = formData.get('stylistId')?.toString();
  if (!stylistId || stylistId === 'unassigned') {
    console.error('Missing stylist id.');
    return;
  }

  const response = await keystoneClient<{ commissions: { id: string }[] }>(
    `
      query UnpaidStylistCommissions($stylistId: ID!) {
        commissions(where: { isPaid: { equals: false }, stylist: { id: { equals: $stylistId } } }, take: 200) { id }
      }
    `,
    { stylistId },
  );

  if (!response.success) {
    console.error('Failed to load stylist commissions:', response.error);
    return;
  }

  const reference = formData.get('reference')?.toString();
  const commissionIds = (response.data.commissions || []).map((commission) => commission.id);
  if (commissionIds.length > 0) await runCommissionPayout(commissionIds, reference);

  const tips = await keystoneClient<{ payoutGratuities: { success: boolean; error?: string | null } }>(
    `
      mutation PayoutGratuities($stylistId: ID!, $reference: String) {
        payoutGratuities(stylistId: $stylistId, reference: $reference) { success error }
      }
    `,
    { stylistId, reference: reference || null },
  );
  if (!tips.success || !tips.data.payoutGratuities.success) {
    console.error('Failed to pay out tips:', tips.success ? tips.data.payoutGratuities.error : tips.error);
  }
  revalidatePath('/dashboard/platform/commissions');
}
