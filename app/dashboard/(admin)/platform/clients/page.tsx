import { ClientsListPage } from '@/features/platform/clients/screens/ClientsListPage';
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission';

function ClientsPage() { return <ClientsListPage />; }
export default withPlatformPermission(ClientsPage, ['canManageClients']);
