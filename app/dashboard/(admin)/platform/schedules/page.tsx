import { StaffSchedulePage } from '@/features/platform/schedules/screens/StaffSchedulePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(StaffSchedulePage, ['canManageSchedules', 'canManageOwnSchedule']);
