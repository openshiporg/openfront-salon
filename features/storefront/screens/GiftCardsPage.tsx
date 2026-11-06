import type { Metadata } from 'next';
import { PageIntro } from '../components/ui/PageIntro';
import { storefrontTitle } from '../lib/data/brand';
import { GiftCardBalance } from '../components/GiftCardBalance';
import { GiftCardBuy } from '../components/GiftCardBuy';

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
          <h2 id="gift-buy" className="sf-display text-[length:var(--sf-text-2xl)]">Buy a gift card</h2>
          <GiftCardBuy />
        </div>
      </section>
      <section aria-labelledby="gift-balance" className="sf-tray-surface p-[var(--sf-space-sm)] md:p-[var(--sf-space-md)]">
        <h2 id="gift-balance" className="sf-display mb-4 text-[length:var(--sf-text-xl)]">Check a balance</h2>
        <GiftCardBalance />
      </section>
    </div>
  </div></div>;
}
