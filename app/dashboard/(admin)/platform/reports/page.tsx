import { SalonWorkspacePage } from '@/features/platform/workspaces/screens/SalonWorkspacePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) { return <SalonWorkspacePage section="reports" searchParams={searchParams} />; }
export default withPlatformPermission(ReportsPage, ['canViewReports']);
