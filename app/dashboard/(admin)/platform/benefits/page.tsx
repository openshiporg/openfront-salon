import { BenefitsPage } from '@/features/platform/benefits/screens/BenefitsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(BenefitsPage, ['canManageCatalog', 'canManageClients']);
