import { prisma } from "@freehold/db";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Serves a user's profile photo. Visible to the user themself and to anyone
 * sharing a workspace with them — photos render on Team and assignment
 * surfaces, never publicly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId, userId } = await requireTenant();
  const { id } = await params;

  if (id !== userId) {
    const shared = await prisma.member.findFirst({
      where: { organizationId: tenantId, userId: id },
      select: { id: true },
    });
    if (!shared) return new Response("Not found", { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { avatarData: true, avatarType: true },
  });
  if (!user?.avatarData || !user.avatarType) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(user.avatarData), {
    headers: {
      "Content-Type": user.avatarType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
