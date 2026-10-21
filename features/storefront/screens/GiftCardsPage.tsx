import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '../components/ui/PageIntro';
import { storefrontTitle } from '../lib/data/brand';

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle('Gift Cards') };
}
export async function GiftCardsPage() {
  return <div className="sf-page-pad"><div className="sf-container max-w-3xl">
    <PageIntro title="Gift cards" size="large" />
    <section className="sf-card grid gap-5 p-[var(--sf-space-lg)]">
      <h2 className="sf-display text-[var(--sf-text-xl)]">In-salon purchase only</h2>
      <p className="text-[var(--sf-text-sm)] text-[var(--sf-ink-2)]">Online gift-card checkout is unavailable.</p>
      <Link href="/contact" className="sf-btn sf-btn-primary">Contact the salon</Link>
      <Link href="/book" className="sf-btn sf-btn-secondary">Book an appointment</Link>
    </section>
  </div></div>;
}
