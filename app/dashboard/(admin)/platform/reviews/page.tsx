import { ReviewQueuePage } from '@/features/platform/reviews/screens/ReviewQueuePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(ReviewQueuePage, ['canManageClients']);
