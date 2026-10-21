import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function ReportsPage() { return <SalonWorkspacePage section="reports" />; }
export default withPlatformPermission(ReportsPage, ['canViewReports']);
