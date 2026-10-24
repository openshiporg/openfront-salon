import { SalesListPage } from '@/features/platform/sales/screens/SalesListPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(SalesListPage, ['canManagePayments', 'canIssueRefunds', 'canViewReports']);
