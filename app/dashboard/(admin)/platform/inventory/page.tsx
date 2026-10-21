import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function InventoryPage() { return <SalonWorkspacePage section="inventory" />; }
export default withPlatformPermission(InventoryPage, ['canManageInventory']);
