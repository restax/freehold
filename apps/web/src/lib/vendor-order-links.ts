import { randomBytes } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";

/**
 * Capability links for orders emailed to unregistered vendors. The token lets
 * them accept and update one order without an account — the portal_link
 * discipline: resolve the capability first (bare-token lookup, no RLS), then do
 * every downstream read tenant-scoped through withTenant(order.tenantId). A
 * token from the request is never trusted to name a tenant or order directly.
 */

const DEFAULT_TTL_DAYS = 30;

/** Create (or refresh) the single live link for an order. Returns the token. */
export async function createOrderLink(
  tenantId: string,
  orderId: string,
  email: string,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 3600 * 1000);
  await prisma.vendorOrderLink.upsert({
    where: { orderId },
    create: { tenantId, orderId, token, email, expiresAt },
    update: { token, email, expiresAt, revokedAt: null },
  });
  return token;
}

/** The absolute URL an emailed vendor clicks. Apex host — no tenant subdomain,
 *  so it works on localhost and self-hosts without wildcard DNS. */
export function orderLinkUrl(token: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/vendor-order/${token}`;
}

export interface ResolvedOrderLink {
  linkId: string;
  tenantId: string;
  email: string;
  order: {
    id: string;
    tenantId: string;
    vendorId: string | null;
    type: string;
    status: string;
    details: string | null;
    dueDate: Date | null;
    scheduledAt: Date | null;
    missedAt: Date | null;
  };
  tenantName: string;
  property: string | null;
}

/** Resolve a live link token to its order, or null if missing/expired/revoked. */
export async function resolveOrderLink(token: string): Promise<ResolvedOrderLink | null> {
  const link = await prisma.vendorOrderLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) return null;

  const order = await withTenant(link.tenantId, (tx) =>
    tx.vendorOrder.findUnique({
      where: { id: link.orderId },
      select: {
        id: true,
        tenantId: true,
        vendorId: true,
        type: true,
        status: true,
        details: true,
        dueDate: true,
        scheduledAt: true,
        missedAt: true,
        transaction: { select: { propertyAddress: true } },
      },
    }),
  );
  if (!order) return null;

  const org = await prisma.organization.findUnique({
    where: { id: link.tenantId },
    select: { name: true },
  });

  // Fire-and-forget access stamp; page rendering never blocks on it.
  prisma.vendorOrderLink
    .update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } })
    .catch(() => {});

  const { transaction, ...orderCore } = order;
  return {
    linkId: link.id,
    tenantId: link.tenantId,
    email: link.email,
    order: orderCore,
    tenantName: org?.name ?? "A transaction coordinator",
    property: transaction?.propertyAddress ?? null,
  };
}
