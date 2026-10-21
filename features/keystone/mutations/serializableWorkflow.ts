import type { Context } from ".keystone/types";
import { assertCurrentWorkflowAuthority } from "./currentWorkflowAuthority";
import { acquireSalonCapacityFence, CAPACITY_WORKFLOWS } from "../scheduling/capacityFence";

const TRANSIENT_CODES = new Set(["P2034", "40001", "40P01"]);
const TRANSIENT_MESSAGE = /\bP2034\b|\bwrite conflict\b|\bdeadlock (?:detected|found)\b|please retry your transaction/i;
const MAX_DIAGNOSTIC_DEPTH = 8;
const MAX_DIAGNOSTIC_NODES = 128;
const MAX_DIAGNOSTIC_STRING_LENGTH = 100_000;

/**
 * Recognize only explicit transaction-conflict evidence, including evidence
 * retained inside Keystone GraphQL extension/debug/original-error wrappers.
 * Generic Prisma, afterOperation, KS_EXTENSION_ERROR, and 25P02 messages are
 * deliberately not retryable by themselves.
 */
export function retryableTransactionError(error: unknown) {
  const seen = new WeakSet<object>();
  let visited = 0;

  function inspect(value: unknown, depth: number, propertyName = ""): boolean {
    if (depth > MAX_DIAGNOSTIC_DEPTH || visited >= MAX_DIAGNOSTIC_NODES || value == null) return false;
    if (typeof value === "string") {
      const diagnostic = value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH);
      if (TRANSIENT_MESSAGE.test(diagnostic)) return true;
      return /^(code|sqlstate|sql_state|prismaCode)$/i.test(propertyName) && TRANSIENT_CODES.has(diagnostic.toUpperCase());
    }
    if (typeof value !== "object") return false;
    if (seen.has(value)) return false;
    seen.add(value); visited += 1;

    // Property descriptors avoid invoking untrusted getters while still
    // traversing Error.cause, GraphQLError.originalError, and extensions.debug.
    let descriptors: Record<string, PropertyDescriptor>;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      return false;
    }
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (!("value" in descriptor)) continue;
      const child = descriptor.value;
      if (/^(code|sqlstate|sql_state|prismaCode)$/i.test(name) && typeof child === "string" && TRANSIENT_CODES.has(child.toUpperCase())) return true;
      if (inspect(child, depth + 1, name)) return true;
    }
    return false;
  }

  return inspect(error, 0);
}

export async function serializableWorkflow<T>(
  context: Context,
  namespace: string,
  lockKeys: string[],
  work: (transactionContext: Context) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.transaction(async (transactionContext) => {
        if (CAPACITY_WORKFLOWS.has(namespace)) await acquireSalonCapacityFence(transactionContext);
        for (const key of [...new Set(lockKeys)].sort()) {
          await transactionContext.prisma.$executeRawUnsafe(
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
            namespace,
            key,
          );
        }
        await assertCurrentWorkflowAuthority(transactionContext);
        return work(transactionContext);
      }, {
        maxWait: 5_000,
        timeout: 30_000,
        isolationLevel: "Serializable" as any,
      });
    } catch (error) {
      if (!retryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Serializable workflow retry exhausted");
}
