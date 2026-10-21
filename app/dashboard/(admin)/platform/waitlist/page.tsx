import { WaitlistPage } from '@/features/platform/waitlist/screens/WaitlistPage'
import { withPlatformPermission } from '@/features/platform/lib/withPlatformPermission'

export default withPlatformPermission(WaitlistPage, ['canManageAppointments', 'canManageClients'])
