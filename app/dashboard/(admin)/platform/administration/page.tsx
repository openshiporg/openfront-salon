import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function AdministrationPage() { return <SalonWorkspacePage section="administration" />; }
export default withPlatformPermission(AdministrationPage, ['canManageSalon']);
