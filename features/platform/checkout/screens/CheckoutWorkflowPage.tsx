import Link from 'next/link';
import { appointmentContact } from '../../lib/appointmentContact';
import { notFound } from 'next/navigation';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { getCheckoutWorkflow } from '../actions/checkout';
import { CheckoutWorkflowCard } from './CheckoutQueuePage';
import { RetryCheckoutWorkflowButton } from './RetryCheckoutWorkflowButton';

interface PageProps { params: Promise<{ id: string }>; searchParams?: Promise<{ retailPage?: string; retailSearch?: string }> }

export async function CheckoutWorkflowPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const filters = await searchParams || {};
  const requestedPage = Number(filters.retailPage || 0);
  const retailPage = Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage <= Math.floor((2147483647 - 30) / 30) ? requestedPage : 0;
  const retailSearch = (filters.retailSearch || '').trim().slice(0, 80);
  const result = await getCheckoutWorkflow(id);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable') {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl">
          <section role="alert" aria-labelledby="checkout-workflow-error-title" className="rounded-2xl border border-amber-300 bg-amber-50 p-8 shadow-sm">
            <h1 id="checkout-workflow-error-title" className="text-xl font-semibold">Checkout temporarily unavailable</h1>
            <p className="mt-2 text-sm text-amber-950">
              Checkout data could not be verified. Appointment, client, and payment details are hidden. Check your access or connection, then retry.
            </p>
            <RetryCheckoutWorkflowButton />
          </section>
        </div>
      </main>
    );
  }
  const { appointment } = result.data;

  const clientName = appointmentContact(appointment).name;
  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-muted/20 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <nav aria-label="Checkout breadcrumbs" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/platform/checkout" className="inline-flex shrink-0 items-center gap-1 font-medium hover:text-foreground"><ArrowLeft className="h-4 w-4" />Checkout</Link>
          <span aria-hidden="true">/</span><span className="truncate">{clientName}</span>
        </nav>
        <header className="rounded-2xl border bg-background p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Checkout for {clientName}</h1></div>
            <Link href={`/dashboard/platform/appointments/${appointment.id}`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"><ReceiptText className="h-4 w-4" />Appointment detail</Link>
          </div>
        </header>
        <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Search retail products at this appointment location">
          <label className="grid gap-1 text-sm">Retail product name or SKU<input name="retailSearch" defaultValue={retailSearch} maxLength={80} className="rounded border bg-background px-3 py-2" /></label>
          <button type="submit" className="rounded border bg-background px-3 py-2 text-sm">Search local stock</button>
        </form>
        <CheckoutWorkflowCard appointment={appointment} retailPage={retailPage} retailSearch={retailSearch} />
      </div>
    </main>
  );
}

export default CheckoutWorkflowPage;
