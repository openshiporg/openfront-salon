import Link from 'next/link';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

export function StoreBrand({ name, logoIcon, logoColor, onClick, size = 'md' }: { name: string | null; logoIcon?: string; logoColor?: string; onClick?: () => void; size?: 'md' | 'lg' }) {
  const safe = sanitizeStoreLogoSvg(logoIcon || '') || DEFAULT_STORE_LOGO_ICON;
  return <Link href="/" onClick={onClick} className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2.5 text-current" data-store-brand>
    <span aria-hidden="true" className={`block shrink-0 [&>svg]:block [&>svg]:size-full ${size === 'lg' ? 'size-10' : 'size-8'}`} style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: safe }} />
    {name ? <span className={`sf-display truncate leading-none ${size === 'lg' ? 'text-[1.875rem]' : 'text-[1.5rem]'}`}>{name}</span> : <span className="sr-only">Home</span>}
  </Link>;
}
