import { CalendarPlus } from 'lucide-react';
import { getStaffBookingData } from '../actions/staffBooking';
import { ErrorState, PageHeader, PlatformPage } from '../../components/salon-ui';
import { StaffBookingForm } from './StaffBookingForm';

type SearchParams = { service?: string; stylist?: string; client?: string; user?: string; name?: string; phone?: string; email?: string; waitlist?: string };

export async function StaffBookingPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [data, params] = await Promise.all([getStaffBookingData(), searchParams ? searchParams : Promise.resolve({} as SearchParams)]);
  return (
    <PlatformPage width="narrow" breadcrumbs={[{ type: 'link', label: 'Appointments', href: '/platform/appointments' }, { type: 'page', label: 'New appointment' }]}>
      <PageHeader icon={CalendarPlus} title="New appointment" />
      {!data ? <ErrorState id="staff-booking-error" title="Booking data couldn't be loaded" message="Reload the page to try again." action={null} /> : (
        <StaffBookingForm
          data={data}
          initial={{
            serviceId: params.service || '',
            stylistId: params.stylist || '',
            clientId: params.client || data.clients.find((client) => params.user && client.userId === params.user)?.id || '',
            waitlistEntryId: params.waitlist || '',
            name: params.name || '',
            phone: params.phone || '',
            email: params.email || '',
          }}
        />
      )}
    </PlatformPage>
  );
}

export default StaffBookingPage;
