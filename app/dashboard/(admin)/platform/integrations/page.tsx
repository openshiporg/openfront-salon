import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function IntegrationsPage() { return <SalonWorkspacePage section="integrations" />; }
export default withPlatformPermission(IntegrationsPage, ['canManageIntegrations']);
