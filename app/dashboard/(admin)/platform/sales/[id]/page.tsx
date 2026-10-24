import { SaleDetailPage } from '@/features/platform/sales/screens/SaleDetailPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(SaleDetailPage, ['canManagePayments', 'canIssueRefunds', 'canViewReports']);
