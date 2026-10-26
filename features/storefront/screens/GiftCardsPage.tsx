import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '../components/ui/PageIntro';
import { storefrontTitle } from '../lib/data/brand';
import { GiftCardBalance } from '../components/GiftCardBalance';

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Gift Cards') };
}
export async function GiftCardsPage() {
  return <div className="sf-page-pad"><div className="sf-container">
    <PageIntro title="Gift cards" />
    <div className="grid gap-[var(--sf-space-md)] md:grid-cols-2">
      <section className="sf-carton" data-band="ink" aria-labelledby="gift-buy">
        <div className="sf-carton-band"><span className="sf-shade" aria-hidden="true" /></div>
        <div className="sf-carton-body !gap-3 !p-[var(--sf-space-sm)] md:!p-[var(--sf-space-md)]">
          <h2 id="gift-buy" className="sf-display text-[length:var(--sf-text-2xl)]">In-salon purchase only</h2>
          <p className="text-[length:var(--sf-text-sm)] text-[var(--sf-ink-2)]">Online gift-card checkout is unavailable.</p>
          <div className="sf-track mt-2">
            <Link href="/contact" className="sf-btn sf-btn-primary">Contact the salon</Link>
            <Link href="/book" className="sf-btn sf-btn-quiet">Book an appointment</Link>
          </div>
        </div>
      </section>
      <section aria-labelledby="gift-balance" className="sf-tray-surface p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
        <h2 id="gift-balance" className="sf-display mb-4 text-[length:var(--sf-text-xl)]">Check a balance</h2>
        <GiftCardBalance />
      </section>
    </div>
  </div></div>;
}
