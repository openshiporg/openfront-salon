import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function EngagementPage() { return <SalonWorkspacePage section="engagement" />; }
export default withPlatformPermission(EngagementPage, ['canManageAppointments', 'canManageClients']);
