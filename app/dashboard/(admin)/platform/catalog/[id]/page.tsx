import { ServiceDetailPage } from '@/features/platform/catalog/screens/ServiceDetailPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(ServiceDetailPage, ['canManageCatalog']);
