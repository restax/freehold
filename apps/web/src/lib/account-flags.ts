import { prisma } from "@freehold/db";
import { flagEmailCopy, hashFlagToken, newFlagToken } from "@/lib/account-flag";
import { operatorEmails } from "@/lib/operator";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";

function baseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3010").replace(/\/+$/, "");
}

/**
 * Send (or re-send) the flagged-account email. Mints a fresh link token each
 * time, which retires any earlier link. Replies land in the first operator's
 * inbox, since the From address is no-reply.
 */
export async function sendFlagEmail(userId: string): Promise<boolean> {
  if (!platformEmailEnabled()) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, flaggedAt: true },
  });
  if (!user?.flaggedAt) return false;
  const { token, hash } = newFlagToken();
  await prisma.user.update({ where: { id: userId }, data: { flagTokenHash: hash } });
  const { subject, text } = flagEmailCopy({
    name: user.name,
    verifyUrl: `${baseUrl()}/verify-account/${token}`,
  });
  await sendPlatformEmail(user.email, subject, text, undefined, undefined, {
    replyTo: operatorEmails()[0],
  });
  return true;
}

/**
 * Flag an account: stop all sign-in, drop live sessions, email the person.
 * Returns whether the email went out (false on installs with no platform mailer).
 */
export async function flagAccount(userId: string, reason: string | null): Promise<boolean> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        flaggedAt: new Date(),
        flagReason: reason?.trim().slice(0, 500) || null,
        flagClearedAt: null,
        flagClearedVia: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  return sendFlagEmail(userId).catch(() => false);
}

export async function clearFlag(userId: string, via: "card" | "operator"): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { flaggedAt: null, flagTokenHash: null, flagClearedAt: new Date(), flagClearedVia: via },
  });
}

/** The flagged user an emailed link belongs to, or null if it's stale or wrong. */
export async function userForFlagToken(token: string) {
  if (!token) return null;
  return prisma.user.findFirst({
    where: { flagTokenHash: hashFlagToken(token), flaggedAt: { not: null } },
    select: { id: true, name: true, email: true },
  });
}
