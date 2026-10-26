import { notFound } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { appointmentContact } from '../../lib/appointmentContact';
import { getCheckoutWorkflow } from '../actions/checkout';
import { CheckoutWorkflowCard } from './CheckoutQueuePage';
import { RetryCheckoutWorkflowButton } from './RetryCheckoutWorkflowButton';
import { appointmentLabel, appointmentTone, ErrorState, inputClass, PageHeader, pillClass, PillLink, PlatformPage, TitleStatus, Track, trackClass } from '../../components/salon-ui';

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
  const paid = appointment.transaction?.status === 'completed' || appointment.payment?.status === 'completed';

  return (
    <PlatformPage breadcrumbs={[{ type: 'link', label: 'Checkout', href: '/platform/checkout' }, { type: 'page', label: clientName }]}>
      <PageHeader
        title={clientName}
        status={<TitleStatus tone={paid ? 'emerald' : appointmentTone[appointment.status || ''] || 'blue'}>{paid ? 'Paid' : appointmentLabel[appointment.status || ''] || 'Checkout'}</TitleStatus>}
        actions={<Track><PillLink href={`/dashboard/platform/appointments/${appointment.id}`}>Appointment<ArrowUpRight /></PillLink></Track>}
      />
      {paid ? null : (
        <form method="get" className="flex w-full flex-wrap items-center gap-2 lg:max-w-[20rem] lg:self-end xl:max-w-[22rem]" aria-label="Search retail products at this appointment location">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Retail product name or SKU</span><Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input name="retailSearch" type="search" defaultValue={retailSearch} maxLength={80} placeholder="Find retail by name or SKU" className={`${inputClass} pl-8`} /></label>
          <div className={trackClass}><button type="submit" className={pillClass('raised')}>Search stock</button></div>
        </form>
      )}
      <CheckoutWorkflowCard appointment={appointment} retailPage={retailPage} retailSearch={retailSearch} showClient={false} />
    </PlatformPage>
  );
}

export default CheckoutWorkflowPage;
