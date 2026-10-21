import { AppointmentDetailPage } from '@/features/platform/appointments/screens/AppointmentDetailPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(AppointmentDetailPage, ['canManageAppointments', 'canManagePayments']);
