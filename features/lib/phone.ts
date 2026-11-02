// One way to show and dial a phone number across salon (dashboard and storefront).

/** Digits and a leading + only, for tel: links. */
export function phoneDial(value?: string | null): string {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  return digits ? `${raw.startsWith('+') ? '+' : ''}${digits}` : '';
}

/**
 * North American numbers read as (555) 010-0299, with +1 dropped. Anything else
 * (international, extensions, short codes) is returned trimmed, as entered.
 */
export function formatPhone(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/[a-z]/i.test(raw.replace(/^tel:/i, ''))) return raw;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  else if (raw.startsWith('+') && !raw.startsWith('+1')) return raw;
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** tel: href for a phone, or null when there is nothing to dial. */
export function phoneHref(value?: string | null): string | null {
  const dial = phoneDial(value);
  return dial ? `tel:${dial}` : null;
}
