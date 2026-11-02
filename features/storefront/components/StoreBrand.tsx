import Link from 'next/link';
import { normalizeStoreLogoColor } from '@/features/lib/store-logo';
import { storeOwnMark } from '../lib/store-mark';

/**
 * The store name, with the mark the store set in Store Settings in its saved colour.
 * With no mark, or only the platform placeholder, the name stands alone.
 */
export function StoreBrand({ name, logoIcon, logoColor, onClick, size = 'md' }: { name: string | null; logoIcon?: string; logoColor?: string; onClick?: () => void; size?: 'md' | 'lg' }) {
  const mark = storeOwnMark(logoIcon);
  return <Link href="/" onClick={onClick} className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2.5 text-current no-underline" data-store-brand>
    {mark ? <span aria-hidden="true" className={`block shrink-0 [&>svg]:block [&>svg]:size-full ${size === 'lg' ? 'size-9' : 'size-6 lg:size-7'}`} style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: mark }} /> : null}
    {name ? <span className={`sf-brand-name min-w-0 ${size === 'lg' ? 'truncate text-[1.75rem]' : 'line-clamp-2 text-[0.875rem] min-[360px]:line-clamp-1 sm:text-[1.25rem] lg:text-[1.625rem]'}`}>{name}</span> : <span className="sr-only">Home</span>}
  </Link>;
}
