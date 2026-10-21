import { AppointmentOperationsPage } from '@/features/platform/appointments/screens/AppointmentOperationsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(AppointmentOperationsPage, ['canManageAppointments']);
