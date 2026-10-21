import { CheckoutWorkflowPage } from '@/features/platform/checkout/screens/CheckoutWorkflowPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(CheckoutWorkflowPage, ['canManagePayments']);
