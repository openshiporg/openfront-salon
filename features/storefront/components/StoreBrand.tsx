import Link from 'next/link';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

export function StoreBrand({ name, logoIcon, logoColor, onClick }: { name: string | null; logoIcon?: string; logoColor?: string; onClick?: () => void }) {
  const safe = sanitizeStoreLogoSvg(logoIcon || '') || DEFAULT_STORE_LOGO_ICON;
  return <Link href="/" onClick={onClick} className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 text-[var(--sf-ink)]" data-store-brand>
    <span aria-hidden="true" className="block size-8 shrink-0 [&>svg]:block [&>svg]:size-full" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />
    {name ? <span className="sf-display truncate text-[1.5rem] leading-tight">{name}</span> : null}
  </Link>;
}
