'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { dollarsToCents, fail, ok, operationKey, workflowState, type FormState } from '@/features/platform/lib/formState';

export interface PlatformGiftCard {
  id: string; code: string; initialValue: number; currentBalance: number; recipientName?: string | null; recipientEmail?: string | null;
  message?: string | null; expiresAt?: string | null; isActive?: boolean | null; createdAt?: string | null;
  purchasedBy?: { name?: string | null; email?: string | null } | null;
  transactions: { id: string; amount: number; type: string; notes?: string | null; createdAt?: string | null; appointment?: { id: string } | null }[];
}

const statusWhere = (status: string, now: string) => ({
  active: { isActive: { equals: true }, currentBalance: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  spent: { currentBalance: { equals: 0 } },
  expired: { expiresAt: { lte: now } },
  inactive: { isActive: { equals: false } },
  all: {},
}[status] || {});

export async function getGiftCards(status: string, search: string) {
  const now = new Date().toISOString();
  const term = search.trim();
  const where = { ...statusWhere(status, now), ...(term ? { OR: [{ code: { contains: term, mode: 'insensitive' } }, { recipientName: { contains: term, mode: 'insensitive' } }, { recipientEmail: { contains: term, mode: 'insensitive' } }] } : {}) };
  const response = await keystoneClient<{ giftCards: PlatformGiftCard[]; active: number; spent: number; expired: number; all: number; balances: { currentBalance: number }[]; clients: { user?: { name?: string | null; email?: string | null } | null }[] }>(`
    query GiftCards($where: GiftCardWhereInput!, $now: DateTime!) {
      giftCards(where: $where, orderBy: { createdAt: desc }, take: 100) {
        id code initialValue currentBalance recipientName recipientEmail message expiresAt isActive createdAt purchasedBy { name email }
        transactions(orderBy: { createdAt: desc }) { id amount type notes createdAt appointment { id } }
      }
      active: giftCardsCount(where: { isActive: { equals: true }, currentBalance: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: $now } }] })
      spent: giftCardsCount(where: { currentBalance: { equals: 0 } })
      expired: giftCardsCount(where: { expiresAt: { lte: $now } })
      all: giftCardsCount
      balances: giftCards(where: { isActive: { equals: true }, OR: [{ expiresAt: null }, { expiresAt: { gt: $now } }] }, take: 5000) { currentBalance }
      clients(where: { user: { email: { not: { equals: "" } } } }, orderBy: { updatedAt: desc }, take: 500) { user { name email } }
    }
  `, { where, now });
  if (!response.success) return null;
  const { giftCards, balances, clients, ...counts } = response.data;
  return {
    giftCards: giftCards || [],
    counts,
    outstanding: (balances || []).reduce((sum, card) => sum + Number(card.currentBalance || 0), 0),
    purchasers: (clients || []).flatMap((client) => client.user?.email ? [{ name: client.user.name || client.user.email, email: client.user.email }] : []),
  };
}

function refresh() {
  revalidatePath('/dashboard/platform/gift-cards');
  revalidatePath('/dashboard/platform/benefits');
}

/** Sells a card at the desk: the tender was collected in the salon, so the manual provider settles it at once. */
export async function sellGiftCard(_previous: FormState, formData: FormData): Promise<FormState> {
  const amount = dollarsToCents(formData.get('amount'));
  const purchaserEmail = String(formData.get('purchaserEmail') || '').trim();
  if (amount === null || amount < 2500 || amount > 50000) return fail('Enter an amount from $25 to $500.');
  if (!purchaserEmail) return fail('Choose the purchaser.');
  const response = await keystoneClient<{ purchaseGiftCard: { success: boolean; paymentSessionId?: string | null; error?: string | null } }>(`
    mutation SellGiftCard($amount: Int!, $recipientEmail: String, $recipientName: String, $message: String, $purchaserEmail: String!, $purchaserName: String!, $idempotencyKey: String!) {
      purchaseGiftCard(amount: $amount, recipientEmail: $recipientEmail, recipientName: $recipientName, message: $message, purchaserEmail: $purchaserEmail, purchaserName: $purchaserName, idempotencyKey: $idempotencyKey) { success paymentSessionId error }
    }
  `, {
    amount, purchaserEmail, purchaserName: String(formData.get('purchaserName') || purchaserEmail),
    recipientEmail: String(formData.get('recipientEmail') || '').trim() || null,
    recipientName: String(formData.get('recipientName') || '').trim() || null,
    message: String(formData.get('message') || '').trim() || null,
    idempotencyKey: String(formData.get('idempotencyKey') || operationKey('desk-gift-card')),
  });
  const state = workflowState(response, 'purchaseGiftCard', 'Gift card issued.', 'The gift card could not be issued. Check your payment access.');
  const sessionId = response.success ? response.data.purchaseGiftCard.paymentSessionId : null;
  if (state.status === 'success' && sessionId) {
    // Confirms the collected tender and sends the code by email when mail is configured.
    await keystoneClient(`mutation ConfirmGiftCard($id: ID!) { confirmGiftCardPurchase(paymentSessionId: $id) { success error } }`, { id: sessionId });
  }
  refresh();
  return state;
}

/** Redeems value at the desk, or returns value to the card (refund authority). */
export async function changeGiftCardBalance(_previous: FormState, formData: FormData): Promise<FormState> {
  const giftCardId = String(formData.get('giftCardId') || '');
  const action = String(formData.get('action') || 'redemption');
  const amount = dollarsToCents(formData.get('amount'));
  const reason = String(formData.get('reason') || '').trim();
  if (!giftCardId) return fail('Gift card not found.');
  if (amount === null || amount <= 0) return fail('Enter an amount in dollars.');
  if (!reason) return fail('Enter a reason.');
  const response = await keystoneClient<{ applyGiftCardBalance: { success: boolean; error?: string | null } }>(`
    mutation ChangeGiftCardBalance($giftCardId: ID!, $action: String!, $amount: Int!, $reason: String, $idempotencyKey: String!) {
      applyGiftCardBalance(giftCardId: $giftCardId, action: $action, amount: $amount, reason: $reason, idempotencyKey: $idempotencyKey) { success error }
    }
  `, { giftCardId, action: action === 'refund' ? 'refund' : 'redemption', amount, reason, idempotencyKey: operationKey('desk-gift-balance') });
  const state = workflowState(response, 'applyGiftCardBalance', action === 'refund' ? 'Value returned to the card.' : 'Redeemed.', 'The balance could not be changed.');
  if (state.status === 'success') refresh();
  return state.status === 'success' ? ok(state.message) : state;
}
