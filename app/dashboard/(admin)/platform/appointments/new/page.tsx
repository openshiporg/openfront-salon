import { StaffBookingPage } from '@/features/platform/appointments/screens/StaffBookingPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(StaffBookingPage, ['canManageAppointments']);
