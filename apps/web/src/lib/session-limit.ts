import { prisma } from "@freehold/db";
import { effectiveTier } from "@/lib/plans";
import { classifyDeviceType } from "@/lib/session-device";

/** Lifetime kick count at which the dashboard shows an "at risk" banner. */
export const SESSION_KICK_RISK_THRESHOLD = 10;

/** True when any of the user's org memberships is effectively on Business —
 * the concurrent-desktop-session limit doesn't apply there (paid upsell). */
export async function hasBusinessMembership(userId: string): Promise<boolean> {
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: {
      organization: { select: { planTier: true, compTier: true, compExpiresAt: true } },
    },
  });
  return memberships.some((m) => effectiveTier(m.organization) === "BUSINESS");
}

/**
 * Called from session.create.before in auth.ts. Classifies the new session's
 * device type and, for non-Business desktop sign-ins, revokes any other live
 * desktop session for this user from a different IP — one desktop session at
 * a time deters password sharing without blocking a legitimate phone+laptop
 * pair. Mobile sessions are never limited, and same-IP desktop sessions
 * (two browser profiles on one machine) are left alone.
 *
 * Returns the deviceType so the caller can merge it into the session being
 * created; the new session is always allowed through — only older sessions
 * ever get revoked.
 */
export async function enforceSessionLimit(session: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<{ deviceType: "desktop" | "mobile" }> {
  const deviceType = classifyDeviceType(session.userAgent);
  if (deviceType !== "desktop" || !session.ipAddress) return { deviceType };
  if (await hasBusinessMembership(session.userId)) return { deviceType };

  const others = await prisma.session.findMany({
    where: {
      userId: session.userId,
      deviceType: "desktop",
      revoked: false,
      expiresAt: { gt: new Date() },
      AND: [{ ipAddress: { not: null } }, { NOT: { ipAddress: session.ipAddress } }],
    },
    select: { id: true },
  });
  if (others.length === 0) return { deviceType };

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { revoked: true, revokedReason: "superseded", expiresAt: new Date() },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { sessionKickCount: { increment: 1 } },
    }),
  ]);
  return { deviceType };
}
