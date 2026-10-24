import { ConsultationsPage } from '@/features/platform/consultations/screens/ConsultationsPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(ConsultationsPage, ['canManageCareRecords']);
