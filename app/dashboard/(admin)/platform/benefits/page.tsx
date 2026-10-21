import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function BenefitsPage() { return <SalonWorkspacePage section="benefits" />; }
export default withPlatformPermission(BenefitsPage, ['canManageCatalog', 'canManageClients']);
