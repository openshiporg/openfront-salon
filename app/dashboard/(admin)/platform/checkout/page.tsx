import { CheckoutQueuePage } from '@/features/platform/checkout/screens/CheckoutQueuePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(CheckoutQueuePage, ['canManagePayments']);
