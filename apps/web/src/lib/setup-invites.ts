import { prisma } from "@freehold/db";
import { hashFlagToken, newFlagToken } from "@/lib/account-flag";
import { operatorEmails } from "@/lib/operator";
import { SETUP_OFFER_KEY } from "@/lib/outreach-emails";
import { claimSend, releaseSend } from "@/lib/outreach-send";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";
import {
  isOfferedSlot,
  MAX_SESSIONS,
  offeredSlots,
  sessionIcs,
  setupOfferEmail,
  slotFullLabel,
} from "@/lib/setup-sessions";

export function setupBaseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3010").replace(/\/+$/, "");
}

/** The invite an emailed link belongs to, or null if the link is wrong. */
export async function inviteForToken(token: string) {
  if (!token) return null;
  return prisma.setupInvite.findUnique({
    where: { tokenHash: hashFlagToken(token) },
    include: { bookings: { orderBy: { startsAt: "asc" } } },
  });
}

/**
 * Send (or re-send) the setup offer. Mints a fresh link each time, which
 * retires the earlier one; existing bookings stay attached to the invite.
 */
export async function sendSetupOffer(
  userId: string,
  again = false,
  test = false,
): Promise<boolean> {
  if (!platformEmailEnabled()) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return false;
  // Once per person unless the operator deliberately sends it again.
  // A test copy to the operator is never recorded as a real send.
  if (!test && !(await claimSend(userId, SETUP_OFFER_KEY, again))) return false;
  try {
    const { token, hash } = newFlagToken();
    await prisma.setupInvite.upsert({
      where: { userId },
      create: { userId, name: user.name, email: user.email, tokenHash: hash },
      update: { name: user.name, email: user.email, tokenHash: hash, sentAt: new Date() },
    });
    const taken = new Set(
      (await prisma.setupBooking.findMany({ select: { startsAt: true } })).map((b) =>
        b.startsAt.getTime(),
      ),
    );
    const mail = setupOfferEmail({
      name: user.name,
      pageUrl: `${setupBaseUrl()}/setup/${token}`,
      slots: offeredSlots().filter((s) => !taken.has(s.getTime())),
    });
    await sendPlatformEmail(
      user.email,
      test ? `[Test] ${mail.subject}` : mail.subject,
      mail.text,
      mail.html,
      undefined,
      {
        replyTo: operatorEmails()[0],
      },
    );
    return true;
  } catch (e) {
    if (!test) await releaseSend(userId, SETUP_OFFER_KEY).catch(() => {});
    throw e;
  }
}

export type BookResult = "booked" | "taken" | "limit" | "unavailable";

/** Book one slot for the person behind a link. */
export async function bookSetupSlot(token: string, at: Date): Promise<BookResult> {
  const invite = await inviteForToken(token);
  if (!invite || Number.isNaN(at.getTime())) return "unavailable";
  if (invite.bookings.length >= MAX_SESSIONS) return "limit";
  if (!isOfferedSlot(at)) return "unavailable";
  let booking: { id: string };
  try {
    booking = await prisma.setupBooking.create({ data: { inviteId: invite.id, startsAt: at } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return "taken";
    throw e;
  }
  notifyBooked(invite, booking.id, at).catch(() => {});
  return "booked";
}

async function notifyBooked(
  invite: { name: string; email: string },
  bookingId: string,
  at: Date,
): Promise<void> {
  if (!platformEmailEnabled()) return;
  const when = slotFullLabel(at);
  const ics = sessionIcs({ id: bookingId, startsAt: at, name: invite.name });
  const replyTo = operatorEmails()[0];
  await sendPlatformEmail(
    invite.email,
    "Your Freehold setup session is booked",
    `Hi ${invite.name.split(/\s+/)[0]},\n\nYou are booked for ${when}. The calendar file is attached. We will send the call details ahead of time, and you can reply to this email with anything you would like to cover.\n\nPaul Slazas\nFounder, Freehold\n774-240-4715 | paul.slazas@freeholdtc.dev`,
    undefined,
    [{ filename: "freehold-setup-session.ics", content: Buffer.from(ics) }],
    { replyTo },
  );
  for (const op of operatorEmails()) {
    await sendPlatformEmail(
      op,
      `Setup session booked: ${invite.name}`,
      `${invite.name} (${invite.email}) booked ${when}.`,
    ).catch(() => {});
  }
}

export async function cancelSetupSlot(token: string, bookingId: string): Promise<void> {
  const invite = await inviteForToken(token);
  if (!invite) return;
  await prisma.setupBooking.deleteMany({ where: { id: bookingId, inviteId: invite.id } });
}
