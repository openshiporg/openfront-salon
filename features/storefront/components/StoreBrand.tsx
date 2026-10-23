import Link from 'next/link';
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo';
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from '@/features/lib/store-logo';

export function StoreBrand({ name, logoIcon, logoColor, onClick, size = 'md' }: { name: string | null; logoIcon?: string; logoColor?: string; onClick?: () => void; size?: 'md' | 'lg' }) {
  const configured = sanitizeStoreLogoSvg(logoIcon || '');
  // The unconfigured default mark takes the storefront accent instead of its stock blue.
  const safe = configured || DEFAULT_STORE_LOGO_ICON.replace('fill="#155eef"', 'fill="currentColor"');
  return <Link href="/" onClick={onClick} className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2.5 text-current" data-store-brand>
    <span aria-hidden="true" className={`block shrink-0 [&>svg]:block [&>svg]:size-full ${size === 'lg' ? 'size-10' : 'size-8'}`} style={configured ? { filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` } : { color: 'var(--sf-accent)' }} dangerouslySetInnerHTML={{ __html: safe }} />
    {name ? <span className={`sf-display min-w-0 ${size === 'lg' ? 'truncate text-[1.875rem] leading-none' : 'line-clamp-2 text-[1.125rem] leading-[1.1] sm:line-clamp-1 sm:text-[1.5rem] sm:leading-none'}`}>{name}</span> : <span className="sr-only">Home</span>}
  </Link>;
}
