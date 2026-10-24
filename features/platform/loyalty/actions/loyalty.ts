'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { fail, ok, workflowState, type FormState } from '@/features/platform/lib/formState';

export interface LoyaltyProgramRecord { id: string; name: string; pointsPerDollar: number; redemptionRate: number; tiers?: { name: string; minPoints: number }[] | null; isActive?: boolean | null }
export interface PointsRecord { id: string; points: number; tier?: string | null; updatedAt?: string | null; client?: { id: string; name?: string | null; email?: string | null } | null; transactions?: { at: string; points: number; reason?: string; source?: string }[] | null }
export interface ReferralRecord { id: string; status?: string | null; rewardAmount: number; rewardType?: string | null; completedAt?: string | null; createdAt?: string | null; referrer?: { name?: string | null; email?: string | null } | null; referred?: { name?: string | null; email?: string | null } | null }

export async function getLoyalty() {
  const response = await keystoneClient<{ loyaltyPrograms: LoyaltyProgramRecord[]; clientPointsList: PointsRecord[]; referrals: ReferralRecord[]; clients: { user?: { id: string; name?: string | null; email?: string | null } | null }[] }>(`
    query Loyalty {
      loyaltyPrograms(orderBy: { createdAt: asc }, take: 10) { id name pointsPerDollar redemptionRate tiers isActive }
      clientPointsList: clientPointsRecords(orderBy: { points: desc }, take: 200) { id points tier updatedAt transactions client { id name email } }
      referrals(orderBy: { createdAt: desc }, take: 200) { id status rewardAmount rewardType completedAt createdAt referrer { name email } referred { name email } }
      clients(where: { user: { email: { not: { equals: "" } } } }, orderBy: { updatedAt: desc }, take: 500) { user { id name email } }
    }
  `);
  if (!response.success) return null;
  return {
    program: response.data.loyaltyPrograms?.[0] || null,
    points: response.data.clientPointsList || [],
    referrals: response.data.referrals || [],
    accounts: (response.data.clients || []).flatMap((client) => client.user ? [{ id: client.user.id, label: `${client.user.name || client.user.email} · ${client.user.email}` }] : []),
  };
}

function refresh() {
  revalidatePath('/dashboard/platform/loyalty');
  revalidatePath('/account');
}

export async function saveProgram(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '').trim();
  const pointsPerDollar = Number(formData.get('pointsPerDollar'));
  const centsPerPoint = Number(formData.get('centsPerPoint'));
  if (!name) return fail('Enter a name.');
  if (!Number.isFinite(pointsPerDollar) || pointsPerDollar < 0 || pointsPerDollar > 100) return fail('Points per dollar must be from 0 to 100.');
  if (!Number.isFinite(centsPerPoint) || centsPerPoint < 0 || centsPerPoint > 100) return fail('Point value must be from 0 to 100 cents.');
  const tiers = formData.getAll('tierName').map(String).map((tierName, index) => ({ name: tierName.trim(), minPoints: Number(formData.getAll('tierMin')[index] || 0) }))
    .filter((tier) => tier.name && Number.isInteger(tier.minPoints) && tier.minPoints >= 0).sort((a, b) => a.minPoints - b.minPoints);
  const data = { name, pointsPerDollar, redemptionRate: centsPerPoint / 100, tiers, isActive: formData.get('isActive') === 'true' };
  const response = id
    ? await keystoneClient(`mutation UpdateProgram($id: ID!, $data: LoyaltyProgramUpdateInput!) { updateLoyaltyProgram(where: { id: $id }, data: $data) { id } }`, { id, data })
    : await keystoneClient(`mutation CreateProgram($data: LoyaltyProgramCreateInput!) { createLoyaltyProgram(data: $data) { id } }`, { data });
  if (!response.success) return fail('The program could not be saved. Check your catalog access.');
  refresh();
  return ok('Program saved.');
}

export async function adjustPoints(_previous: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get('userId') || '');
  const direction = String(formData.get('direction') || 'add');
  const amount = Number(formData.get('points'));
  const reason = String(formData.get('reason') || '').trim();
  if (!userId) return fail('Choose a client.');
  if (!Number.isInteger(amount) || amount <= 0) return fail('Enter a whole number of points.');
  const response = await keystoneClient<{ adjustClientPoints: { success: boolean; error?: string | null } }>(`
    mutation AdjustPoints($userId: ID!, $points: Int!, $reason: String!) { adjustClientPoints(userId: $userId, points: $points, reason: $reason) { success error } }
  `, { userId, points: direction === 'redeem' ? -amount : amount, reason });
  const state = workflowState(response, 'adjustClientPoints', direction === 'redeem' ? 'Points redeemed.' : 'Points added.', 'Points could not be changed.');
  if (state.status === 'success') refresh();
  return state;
}

export async function createReferral(_previous: FormState, formData: FormData): Promise<FormState> {
  const referrerId = String(formData.get('referrerId') || '');
  const referredId = String(formData.get('referredId') || '');
  const rewardAmount = Number(formData.get('rewardAmount') || 0);
  if (!referrerId || !referredId) return fail('Choose both clients.');
  if (referrerId === referredId) return fail('A client can’t refer themselves.');
  if (!Number.isInteger(rewardAmount) || rewardAmount < 0) return fail('Reward must be a whole number of points.');
  const response = await keystoneClient(`mutation CreateReferral($data: ReferralCreateInput!) { createReferral(data: $data) { id } }`, {
    data: { referrer: { connect: { id: referrerId } }, referred: { connect: { id: referredId } }, rewardAmount, rewardType: 'points', status: 'pending' },
  });
  if (!response.success) return fail('The referral could not be saved.');
  refresh();
  return ok('Referral recorded.');
}

export async function finishReferral(_previous: FormState, formData: FormData): Promise<FormState> {
  const response = await keystoneClient<{ completeReferral: { success: boolean; error?: string | null } }>(`
    mutation CompleteReferral($referralId: ID!) { completeReferral(referralId: $referralId) { success error } }
  `, { referralId: String(formData.get('id') || '') });
  const state = workflowState(response, 'completeReferral', 'Referral completed.', 'The referral could not be completed.');
  if (state.status === 'success') refresh();
  return state;
}
