import { StoreSettingsPageServer } from '@/features/platform/store-settings/screens/StoreSettingsPageServer';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(StoreSettingsPageServer, ['canManageSalon']);
