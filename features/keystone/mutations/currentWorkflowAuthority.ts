import type { Context } from '.keystone/types';
import { permissions } from '../access';

const ROLE_FLAGS = Object.keys(permissions);

/**
 * Transaction-local authority fence. The actor and assigned role cannot be
 * revoked/reassigned until this command commits. Normal Keystone reads still
 * govern the projection; the parameterized SQL only locks the actor's own rows.
 * Captured preflight flags may not survive a revocation, even on idempotent replay.
 */
export async function assertCurrentWorkflowAuthority(context: Context): Promise<void> {
  const session = context.session;
  if (!session) return; // Public commands have their own finite input boundary.
  if (session.listKey !== 'User' || !session.itemId) throw new Error('Current session authority is required');
  const actors = await context.prisma.$queryRawUnsafe<Array<{ id: string; role: string | null }>>(
    'SELECT "id", "role" FROM "User" WHERE "id" = $1 FOR SHARE', session.itemId,
  );
  if (actors.length !== 1) throw new Error('Current session authority is required');
  if (actors[0].role) await context.prisma.$queryRawUnsafe('SELECT "id" FROM "Role" WHERE "id" = $1 FOR SHARE', actors[0].role);
  const actor = await context.query.User.findOne({ where: { id: session.itemId }, query: `id role { ${ROLE_FLAGS.join(' ')} }` });
  if (!actor || actor.id !== session.itemId) throw new Error('Current session authority is required');
  const claimed = session.data?.role as Record<string, unknown> | null | undefined;
  const actual = actor.role as Record<string, unknown> | null;
  if (ROLE_FLAGS.some(flag => claimed?.[flag] === true && actual?.[flag] !== true)) throw new Error('Authority changed; sign in again before retrying');
}
