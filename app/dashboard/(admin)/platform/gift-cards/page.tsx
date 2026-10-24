import { GiftCardsPage } from '@/features/platform/gift-cards/screens/GiftCardsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(GiftCardsPage, ['canManagePayments']);
