import { ResourceOperationsPage } from '@/features/platform/resources/screens/ResourceOperationsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(ResourceOperationsPage, ['canManageResources', 'canManageAppointments']);
