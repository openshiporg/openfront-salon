import { ClientProfilePage } from '@/features/platform/clients/screens/ClientProfilePage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

export default withPlatformPermission(ClientProfilePage, ['canManageClients']);
