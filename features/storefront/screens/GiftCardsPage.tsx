import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { PageIntro } from '../components/ui/PageIntro';
import { storefrontTitle } from '../lib/data/brand';

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Gift Cards') };
}
export async function GiftCardsPage() {
  return <div className="sf-page-pad"><div className="sf-container">
    <PageIntro title={<>Gift <em>cards</em></>} size="large" />
    <section className="sf-ticket max-w-2xl overflow-hidden">
      <div className="flex items-center gap-5 p-[var(--sf-space-md)] md:p-[var(--sf-space-lg)]">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--sf-accent-soft)] text-[var(--sf-accent-deep)]"><Gift className="h-6 w-6" aria-hidden="true" /></span>
        <div>
          <h2 className="sf-display text-[var(--sf-text-2xl)]">In-salon purchase only</h2>
          <p className="mt-1 text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Online gift-card checkout is unavailable.</p>
        </div>
      </div>
      <div className="sf-ticket-perf" />
      <div className="p-[var(--sf-space-md)] md:px-[var(--sf-space-lg)]">
        <div className="sf-track">
          <Link href="/contact" className="sf-btn sf-btn-primary">Contact the salon</Link>
          <Link href="/book" className="sf-btn sf-btn-quiet">Book an appointment</Link>
        </div>
      </div>
    </section>
  </div></div>;
}
