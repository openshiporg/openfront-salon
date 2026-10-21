import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function CatalogPage() { return <SalonWorkspacePage section="catalog" />; }
export default withPlatformPermission(CatalogPage, ['canManageCatalog']);
