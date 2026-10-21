import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function ClientsPage() { return <SalonWorkspacePage section="clients" />; }
export default withPlatformPermission(ClientsPage, ['canManageClients']);
