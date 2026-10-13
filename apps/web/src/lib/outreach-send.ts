import { prisma } from "@freehold/db";

/**
 * Claim the right to send one numbered email to one person. True means this
 * caller owns the send and should go ahead; false means it already went out.
 * The unique (user, email) pair makes this safe against two clicks at once.
 * `again` is the operator deliberately re-sending, which always proceeds and
 * counts the resend.
 */
export async function claimSend(userId: string, emailKey: string, again = false): Promise<boolean> {
  try {
    await prisma.outreachSend.create({ data: { userId, emailKey } });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  if (!again) return false;
  await prisma.outreachSend.update({
    where: { userId_emailKey: { userId, emailKey } },
    data: { sentAt: new Date(), resends: { increment: 1 } },
  });
  return true;
}

/** Hand the claim back after a send that failed, so it can be retried. */
export async function releaseSend(userId: string, emailKey: string): Promise<void> {
  await prisma.outreachSend.deleteMany({ where: { userId, emailKey, resends: 0 } });
}
