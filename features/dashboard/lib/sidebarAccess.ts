/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type SidebarUser = { role?: ({ canAccessDashboard?: boolean | null } & Record<string, boolean | null | undefined>) | null } | null | undefined

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/**
 * A platform page whose first segment is a list path follows that list's visibility;
 * pages that are not tied to one list stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string; requires?: readonly string[] }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  const role = user?.role
  return items.filter((item) => {
    // A role the session can read must satisfy the page guard, or the link would land on no-access.
    if (role && item.requires && role.canManageSalon !== true && !item.requires.some((permission) => role[permission] === true)) return false
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0]
    return !slug || !hiddenPaths.has(slug)
  })
}
