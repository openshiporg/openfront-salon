/**
 * Filter and order access for every field, derived from the same rules that gate reading.
 *
 * Keystone checks `isFilterable`/`isOrderable` for every field in a `where` (also nested through relations),
 * but defaults them to true. A `Count(where: ...)` through a field or relation a role cannot read then
 * answers yes/no questions about hidden values (staff email, client notes, payment status).
 *
 * - Scalars: filterable only when the session can read the field. Passwords, tokens and json blobs never.
 * - Relations: filterable only when the session can query the target list, and either reads every row of
 *   it, or is itself limited to its own rows on this side (a client walking from their own appointment to
 *   their own profile).
 *
 * Applied once to every list (including those withAuth adds), so both sides of each relation agree.
 */
type Args = { session?: any; context?: any; listKey: string; fieldKey?: string }

const asRule = (rule: any, fallback = true) => (rule === undefined ? fallback : rule)

async function run(rule: any, args: any): Promise<any> {
  try {
    return typeof rule === 'function' ? await rule(args) : rule
  } catch {
    return false
  }
}

function operationQuery(list: any) {
  const access = list?.access
  if (typeof access === 'function') return access
  const operation = access?.operation
  if (typeof operation === 'function') return operation
  return asRule(operation?.query)
}

function filterQuery(list: any) {
  const access = list?.access
  if (!access || typeof access === 'function') return undefined
  return access.filter?.query
}

function readRule(field: any) {
  const access = field?.access
  if (typeof access === 'function') return access
  if (access && typeof access === 'object') return asRule(access.read)
  return asRule(access)
}

const canQueryList = async (list: any, args: Args) =>
  Boolean(await run(operationQuery(list), { ...args, operation: 'query' }))

/** True when the session reads every row of the list (no row filter, or a filter that returns true). */
const readsAllRows = async (list: any, args: Args) => {
  const rule = filterQuery(list)
  if (rule === undefined) return true
  return (await run(rule, { ...args, operation: 'query' })) === true
}

function buildRule(lists: Record<string, any>, listKey: string, fieldKey: string, field: any, previous: any) {
  const neverFilterable =
    (field.dbField?.kind === 'scalar' && field.dbField.scalar === 'Json') ||
    String(field.views ?? '').includes('password')

  return async ({ session, context }: { session?: any; context?: any }) => {
    if (neverFilterable) return false
    const args: Args = { session, context, listKey, fieldKey }
    if (previous !== undefined && !(await run(previous, args))) return false
    if (!(await run(readRule(field), { ...args, operation: 'read' }))) return false
    if (field.dbField?.kind !== 'relation') return true

    const target = lists[field.dbField.list]
    if (!target) return false
    const targetArgs: Args = { session, context, listKey: field.dbField.list }
    if (!(await canQueryList(target, targetArgs))) return false
    if (await readsAllRows(target, targetArgs)) return true
    return !(await readsAllRows(lists[listKey], { session, context, listKey }))
  }
}

export function withFilterAccess<T extends Record<string, any>>(lists: T): T {
  return Object.fromEntries(
    Object.entries(lists).map(([listKey, list]) => [
      listKey,
      {
        ...list,
        fields: Object.fromEntries(
          Object.entries(list.fields ?? {}).map(([fieldKey, fieldFunc]) => {
            if (typeof fieldFunc !== 'function' || fieldKey.startsWith('__group')) return [fieldKey, fieldFunc]
            return [
              fieldKey,
              (info: any) => {
                const field = (fieldFunc as any)(info)
                return {
                  ...field,
                  isFilterable: buildRule(lists, listKey, fieldKey, field, field.isFilterable),
                  isOrderable: buildRule(lists, listKey, fieldKey, field, field.isOrderable),
                }
              },
            ]
          }),
        ),
      },
    ]),
  ) as T
}
