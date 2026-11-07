/**
 * Every relation here is ON DELETE SET NULL, so deleting a record that history points at would
 * quietly detach that history: client memberships lose their plan, sold packages lose their
 * definition, staff lose their role, sent messages lose their template. Those records are turned
 * off (isActive) instead. A record nothing points at can still be deleted.
 * `tests/invariants.test.ts` checks every entry against the Prisma schema.
 */
export const DELETE_HISTORY: Record<string, { references: { model: string; field: string; one: string; many: string }[]; instead: string }> = {
  Membership: {
    instead: 'Turn off Active instead so nobody new can join.',
    references: [{ model: 'clientMembership', field: 'membershipId', one: 'client membership', many: 'client memberships' }],
  },
  ServicePackage: {
    instead: 'Turn off Active instead so it is no longer sold.',
    references: [{ model: 'clientPackage', field: 'packageId', one: 'sold package', many: 'sold packages' }],
  },
  MessageTemplate: {
    instead: 'Turn off Active instead so it is no longer sent.',
    references: [{ model: 'messageLog', field: 'templateId', one: 'sent message', many: 'sent messages' }],
  },
  Role: {
    instead: 'Give them another role first.',
    references: [{ model: 'user', field: 'roleId', one: 'person still has', many: 'people still have' }],
  },
};

export async function deleteHistoryProblem(prisma: any, listKey: string, id: string) {
  const rule = DELETE_HISTORY[listKey];
  if (!rule) return null;
  const counts = await Promise.all(rule.references.map(ref => prisma[ref.model].count({ where: { [ref.field]: id } })));
  const found = rule.references.map((ref, i) => counts[i] ? `${counts[i]} ${counts[i] === 1 ? ref.one : ref.many}` : '').filter(Boolean);
  if (!found.length) return null;
  return listKey === 'Role'
    ? `${found.join(', ')} this role. ${rule.instead}`
    : `This is used by ${found.join(', ')}. ${rule.instead}`;
}

export function historyDeleteGuard(listKey: string) {
  return async ({ item, context, addValidationError }: any) => {
    const problem = await deleteHistoryProblem(context.prisma, listKey, String(item.id));
    if (problem) addValidationError(problem);
  };
}
