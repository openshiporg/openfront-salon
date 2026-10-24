'use server';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export interface StaffProfile {
  id: string; role?: string | null; tier?: string | null; status?: string | null; bio?: string | null; hireDate?: string | null; employmentType?: string | null;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  photo?: { imagePath?: string | null; image?: { url?: string | null } | null } | null;
  locations: { id: string; name?: string | null; timezone?: string | null }[];
  specializations: { id: string; name?: string | null }[];
  schedules: { id: string; type?: string | null; dayOfWeek?: number | null; localDate?: string | null; startTime?: string | null; endTime?: string | null; breakStart?: string | null; breakEnd?: string | null; isAvailable?: boolean | null; reason?: string | null }[];
  reviews: { id: string; rating: number; comment?: string | null; isApproved?: boolean | null }[];
}

export async function getStaffProfile(id: string) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const response = await keystoneClient<{
    stylist: StaffProfile | null;
    upcoming: { id: string; startTime: string; status: string; client?: { displayName?: string | null } | null; services: { name?: string | null }[]; location?: { timezone?: string | null } | null }[];
    upcomingCount: number; completedCount: number; noShowCount: number;
  }>(`
    query StaffProfile($id: ID!, $now: DateTime!, $today: String!) {
      stylist(where: { id: $id }) {
        id role tier status bio hireDate employmentType
        user { name email phone } photo { imagePath image { url } }
        locations { id name timezone } specializations { id name }
        schedules(where: { OR: [{ type: { equals: recurring } }, { type: { equals: time_off }, isAvailable: { equals: false }, localDate: { gte: $today } }] }, orderBy: [{ dayOfWeek: asc }, { localDate: asc }]) { id type dayOfWeek localDate startTime endTime breakStart breakEnd isAvailable reason }
        reviews(orderBy: { createdAt: desc }, take: 20) { id rating comment isApproved }
      }
      upcoming: appointments(where: { stylist: { id: { equals: $id } }, status: { in: [pending, confirmed, in_progress] }, startTime: { gte: $now } }, orderBy: { startTime: asc }, take: 8) {
        id startTime status client { displayName } services { name } location { timezone }
      }
      upcomingCount: appointmentsCount(where: { stylist: { id: { equals: $id } }, status: { in: [pending, confirmed] }, startTime: { gte: $now } })
      completedCount: appointmentsCount(where: { stylist: { id: { equals: $id } }, status: { equals: completed } })
      noShowCount: appointmentsCount(where: { stylist: { id: { equals: $id } }, status: { equals: no_show } })
    }
  `, { id, now, today });
  if (!response.success || !response.data.stylist) return null;
  const stylist: StaffProfile = response.data.stylist;
  // Earnings need commission authority; the profile loads without them.
  const earnings = await keystoneClient<{ commissions: { commissionAmount: number; isPaid?: boolean | null; saleAmount: number }[]; gratuityLedgerEntries: { amountDelta: number; payoutStatus: string; payment?: { paymentMethod?: string | null } | null }[] }>(`
    query StaffEarnings($id: ID!) {
      commissions(where: { stylist: { id: { equals: $id } } }, take: 5000) { commissionAmount isPaid saleAmount }
      gratuityLedgerEntries(where: { practitioner: { id: { equals: $id } } }, take: 5000) { amountDelta payoutStatus payment { paymentMethod } }
    }
  `, { id });
  const totals = earnings.success ? {
    sales: earnings.data.commissions.reduce((sum, item) => sum + Number(item.saleAmount || 0), 0),
    commissionOwed: earnings.data.commissions.filter((item) => !item.isPaid).reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0),
    commissionPaid: earnings.data.commissions.filter((item) => item.isPaid).reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0),
    tipsOwed: earnings.data.gratuityLedgerEntries.filter((item) => item.payoutStatus === 'payable' && item.payment?.paymentMethod !== 'cash').reduce((sum, item) => sum + Number(item.amountDelta || 0), 0),
    tipsTotal: earnings.data.gratuityLedgerEntries.reduce((sum, item) => sum + Number(item.amountDelta || 0), 0),
  } : null;
  return { ...response.data, stylist, earnings: totals };
}
