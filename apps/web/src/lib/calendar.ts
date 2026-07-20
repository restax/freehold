import { randomBytes } from "node:crypto";
import { prisma } from "@freehold/db";

/**
 * Each person's subscribe-once personal calendar: their open, dated tasks and
 * the closings on files they're assigned to, across this workspace. Scoped to
 * the Member row (tenant + user), not the User globally, so someone in two
 * workspaces gets two separate feeds — same as roles and assignments.
 */

const baseUrl = () => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The signed-in person's calendar token in this tenant, generating one if none exists yet. */
export async function ensureCalendarToken(tenantId: string, userId: string): Promise<string> {
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true, calendarToken: true },
  });
  if (member?.calendarToken) return member.calendarToken;
  if (!member) throw new Error("Not a member of this workspace.");

  const token = randomBytes(24).toString("base64url");
  await prisma.member.update({ where: { id: member.id }, data: { calendarToken: token } });
  return token;
}

export function calendarFeedUrl(token: string): string {
  return `${baseUrl()}/api/calendar/${token}/feed.ics`;
}
