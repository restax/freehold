import { prisma } from "@freehold/db";
import { type Appearance, parseAppearance } from "@/lib/theme";

/**
 * Reading a workspace's stored appearance.
 *
 * The colour system itself lives in `lib/theme.ts`, which has no database
 * import so client components can use it. This module is the one piece that
 * touches Prisma, kept separate for that reason.
 *
 * Re-exports the theme module so existing server-side imports of
 * `@/lib/appearance` keep working — but a **client** component must import
 * from `@/lib/theme` directly, or it pulls the database client with it.
 */
export * from "@/lib/theme";

export async function tenantAppearance(tenantId: string): Promise<Appearance> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { appearanceConfig: true },
  });
  return parseAppearance(org?.appearanceConfig);
}
