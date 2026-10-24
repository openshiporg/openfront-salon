import { LoyaltyPage } from '@/features/platform/loyalty/screens/LoyaltyPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(LoyaltyPage, ['canManageClients']);
