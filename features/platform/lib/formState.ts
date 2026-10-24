import type { KeystoneResponse } from '@/features/dashboard/lib/keystoneClient';

export type FormState = { status: 'idle' | 'success' | 'error'; message: string };

export const ok = (message: string): FormState => ({ status: 'success', message });
export const fail = (message: string): FormState => ({ status: 'error', message });

/** Reads a `{ success, error }` workflow result into form feedback. */
export function workflowState(response: KeystoneResponse<any>, field: string, success: string, fallback: string): FormState {
  if (!response.success) return fail(fallback);
  const result = response.data?.[field];
  if (result && typeof result === 'object' && 'success' in result) return result.success ? ok(success) : fail(result.error || fallback);
  return result ? ok(success) : fail(fallback);
}

/** Whole dollars and cents typed by staff ("12.50") to integer cents; null when invalid. */
export function dollarsToCents(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim().replace(/[$,]/g, '');
  if (!text || !/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

export function operationKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}
