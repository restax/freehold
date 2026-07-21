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
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    // Prisma's defaults (5s timeout) suit local databases; over a managed
    // Postgres with real network latency, multi-statement transactions like
    // sample-data seeding can overrun them from a cold start.
    { maxWait: 5_000, timeout: 15_000 },
  );
}

/**
 * The vendor-side mirror of `withTenant`, for FreeholdVendors cross-boundary
 * tables (vendor_connection, vendor_order, …). Sets `app.vendor_id` so those
 * tables' RLS policies — `tenant_id = app.tenant_id OR vendor_id = app.vendor_id`
 * — let a vendor read exactly its own rows and nothing else.
 *
 * A vendor has no tenant, so it can never use `withTenant`; a coordinator has
 * no vendor, so it never uses this. Only one of the two session variables is
 * ever set in a given transaction, which is also what makes each side's
 * `WITH CHECK` pin inserts to itself — a vendor cannot conjure a row naming a
 * tenant it isn't connected to, and vice versa.
 */
export async function withVendor<T>(
  vendorId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.vendor_id', ${vendorId}, true)`;
      return fn(tx);
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
}
