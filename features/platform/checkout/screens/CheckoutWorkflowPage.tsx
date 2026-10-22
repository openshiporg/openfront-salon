import { notFound } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { appointmentContact } from '../../lib/appointmentContact';
import { getCheckoutWorkflow } from '../actions/checkout';
import { CheckoutWorkflowCard } from './CheckoutQueuePage';
import { RetryCheckoutWorkflowButton } from './RetryCheckoutWorkflowButton';
import { ErrorState, inputClass, PageHeader, pillClass, PillLink, PlatformPage, Track, trackClass } from '../../components/salon-ui';

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
      <PlatformPage breadcrumbs={[{ type: 'link', label: 'Checkout', href: '/platform/checkout' }, { type: 'page', label: 'Unavailable' }]} width="narrow">
        <ErrorState
          id="checkout-workflow-error-title"
          title="Checkout temporarily unavailable"
          message="Checkout data could not be verified. Appointment, client, and payment details are hidden. Check your access or connection, then retry."
          action={<RetryCheckoutWorkflowButton />}
        />
      </PlatformPage>
    );
  }
  const { appointment } = result.data;
  const clientName = appointmentContact(appointment).name;

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Checkout', href: '/platform/checkout' }, { type: 'page', label: clientName }]}>
      <PageHeader
        title={`Checkout · ${clientName}`}
        actions={<Track><PillLink href={`/dashboard/platform/appointments/${appointment.id}`}>Appointment<ArrowUpRight /></PillLink></Track>}
      />
      <form method="get" className="flex w-full max-w-xl flex-wrap items-center gap-2" aria-label="Search retail products at this appointment location">
        <label className="min-w-0 flex-1"><span className="sr-only">Retail product name or SKU</span><input name="retailSearch" defaultValue={retailSearch} maxLength={80} placeholder="Retail product name or SKU" className={inputClass} /></label>
        <div className={trackClass}><button type="submit" className={pillClass('raised')}><Search />Search stock</button></div>
      </form>
      <CheckoutWorkflowCard appointment={appointment} retailPage={retailPage} retailSearch={retailSearch} />
    </PlatformPage>
  );
}

export default CheckoutWorkflowPage;
