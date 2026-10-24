import { StaffProfilePage } from '@/features/platform/staff/screens/StaffProfilePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(StaffProfilePage, ['canManageSchedules', 'canManageAppointments']);
