import { CommissionOperationsPage } from '@/features/platform/commissions/screens/CommissionOperationsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(CommissionOperationsPage, ['canManageCommissions']);
