import type { Context } from '.keystone/types';

/** Shared by every controlled writer of appointment/schedule/resource eligibility.
 * Extends the existing booking capacity lock namespace; avoids separate namespaces
 * allowing booking, rescheduling and staff/resource changes to pass each other.
 */
export async function acquireSalonCapacityFence(context: Context) {
  await context.prisma.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', 'salon-appointment-capacity', '!writers');
}
export const CAPACITY_WORKFLOWS = new Set(['salon-segment-schedule', 'salon-segment-transition', 'salon-schedule', 'salon-resource', 'salon-management', 'salon-appointment-transition']);
