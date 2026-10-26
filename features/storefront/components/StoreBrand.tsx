import Link from 'next/link';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ACCENT_SVG, isDefaultStoreLogo, normalizeStoreLogoColor } from '@/features/lib/store-logo';

export function StoreBrand({ name, logoIcon, logoColor, onClick, size = 'md' }: { name: string | null; logoIcon?: string; logoColor?: string; onClick?: () => void; size?: 'md' | 'lg' }) {
  // The default mark, saved or not, takes the storefront band colour instead of its stock blue.
  const configured = isDefaultStoreLogo(logoIcon) ? '' : sanitizeStoreLogoSvg(logoIcon || '');
  const safe = configured || DEFAULT_STORE_LOGO_ACCENT_SVG;
  return <Link href="/" onClick={onClick} className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2.5 text-current no-underline" data-store-brand>
    <span aria-hidden="true" className={`block shrink-0 [&>svg]:block [&>svg]:size-full ${size === 'lg' ? 'size-9' : 'size-7'}`} style={configured ? { filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` } : { color: 'var(--sf-band-1)' }} dangerouslySetInnerHTML={{ __html: safe }} />
    {name ? <span className={`sf-brand-name min-w-0 ${size === 'lg' ? 'truncate text-[1.75rem]' : 'line-clamp-2 text-[1.125rem] sm:line-clamp-1 sm:text-[1.375rem]'}`}>{name}</span> : <span className="sr-only">Home</span>}
  </Link>;
}
