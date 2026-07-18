import type { Prisma } from "@prisma/client";
import { prisma } from "./client.js";

export type TenantTx = Prisma.TransactionClient;

/**
 * Run `fn` inside a transaction scoped to one tenant. Sets the Postgres
 * session variable `app.tenant_id` (transaction-local via SET LOCAL semantics)
 * that the row-level-security policies on domain tables key off, so even a
 * missing `where: { tenantId }` cannot leak rows across tenants.
 *
 * Every domain-table query must go through this helper. Note: RLS applies
 * when the app connects as a non-superuser role; the helper's set_config is
 * still the single place tenant scoping happens either way.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
