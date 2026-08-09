import { prisma, withTenant } from "@freehold/db";
import { CLIENT_TYPE_GROUPS, groupEnabled } from "@/lib/client-types";

/**
 * The workspace's client-type switches plus how many clients sit under each.
 *
 * Deliberately not in the "use server" actions module: that hands every
 * export to the browser as a callable endpoint, and this takes a tenantId.
 * Same reasoning as storeOneUpload in actions/documents.ts.
 */
export async function clientTypeUsage(tenantId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: {
      clientTypeAgentEnabled: true,
      clientTypeOfficeEnabled: true,
      privateLendingEnabled: true,
    },
  });
  const counts = await withTenant(tenantId, (tx) =>
    tx.client.groupBy({ by: ["type"], _count: { _all: true } }),
  );
  const byType = new Map(counts.map((c) => [String(c.type), c._count._all]));
  return CLIENT_TYPE_GROUPS.map((g) => ({
    ...g,
    enabled: groupEnabled(g.key, org),
    // A line of work with clients under it can't be switched off; the count
    // is what the screen shows to explain why.
    inUse: g.types.reduce((sum, t) => sum + (byType.get(t) ?? 0), 0),
  }));
}
