import { prisma } from "@freehold/db";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";

/**
 * Nightly sweep: settle any signup trial (see startSignupTrial in comp.ts)
 * that lapsed unconverted onto Free.
 *
 * Correctness doesn't actually depend on this running — the moment
 * compExpiresAt passes, every plan-limit read already falls back to planTier
 * (FREE) on its own via effectiveTier() in plans.ts. This job exists to make
 * the downgrade explicit (clears the now-stale compTier/compExpiresAt rather
 * than leaving them dangling) and to tell the workspace it happened. Clearing
 * those two columns doubles as the "already handled" marker: a rerun's WHERE
 * clause simply finds nothing, so this is naturally idempotent.
 *
 * Excludes any org with a stripeSubscriptionId — the webhook route clears
 * compTier itself the moment a real subscription starts, but even if that
 * write hasn't landed yet on a given night, a set stripeSubscriptionId alone
 * is enough to keep this job from wrongly downgrading a converted trial.
 */
export async function runTrialDowngrades(): Promise<{ downgraded: number; emailed: number }> {
  const lapsed = await prisma.organization.findMany({
    where: {
      compTier: "PRO",
      compExpiresAt: { lt: new Date() },
      stripeSubscriptionId: null,
    },
    select: { id: true, name: true },
  });

  let emailed = 0;
  for (const org of lapsed) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { compTier: null, compExpiresAt: null },
    });
    if (platformEmailEnabled()) {
      const owners = await prisma.member.findMany({
        where: { organizationId: org.id, role: { in: ["owner", "admin"] } },
        select: { user: { select: { email: true } } },
      });
      const to = [...new Set(owners.map((m) => m.user.email).filter(Boolean))];
      for (const email of to) {
        await sendPlatformEmail(
          email,
          "Your Freehold Pro trial has ended",
          `Your 14-day Pro trial for ${org.name} has ended, and the workspace is now on the Free plan.\n\nYour data is untouched — nothing is deleted or locked. Add a card any time from Billing in your dashboard to pick back up where you left off, full AI and all.\n\n— Freehold`,
        ).catch(() => {});
        emailed++;
      }
    }
  }

  return { downgraded: lapsed.length, emailed };
}
