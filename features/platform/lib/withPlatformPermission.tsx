import { redirect } from 'next/navigation';
import { getPlatformActor } from './getPlatformActor';
import type { PlatformPermission } from './navigation';

export function withPlatformPermission<P extends object>(
  Component: React.ComponentType<P>,
  required: readonly PlatformPermission[],
  managerOverride = true,
) {
  return async function PermissionGuardedPlatformPage(props: P) {
    const response = await getPlatformActor();
    const role = response.success ? response.data?.authenticatedItem?.role : null;
    const allowed = (managerOverride && role?.canManageSalon === true) || required.some((permission) => role?.[permission] === true);
    if (!allowed) redirect('/dashboard/no-access');
    return <Component {...props} />;
  };
}
