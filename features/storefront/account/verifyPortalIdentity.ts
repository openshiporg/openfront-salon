type PortalIdentity = { id?: string | null; clientProfile?: { id?: string | null } | null };

/** Auth mutation selections use the old request context. Verify in a fresh token-scoped request. */
export async function verifyPortalIdentity(
  auth: { sessionToken?: string | null; item?: { id?: string | null } | null } | null,
  readIdentity: (sessionToken: string) => Promise<PortalIdentity | null>,
): Promise<boolean> {
  if (!auth?.sessionToken || !auth.item?.id) return false;
  try {
    const identity = await readIdentity(auth.sessionToken);
    return identity?.id === auth.item.id && Boolean(identity?.clientProfile?.id);
  } catch {
    return false;
  }
}
