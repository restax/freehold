"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { str } from "@/lib/forms";
import { isOperator, operatorEmails } from "@/lib/operator";
import { SETUP_OFFER_KEY } from "@/lib/outreach-emails";
import { getSession } from "@/lib/session";
import { bookSetupSlot, cancelSetupSlot, sendSetupOffer } from "@/lib/setup-invites";

/** Public: the emailed link's token is the authority, no sign-in. */
export async function bookSetupSession(formData: FormData) {
  const token = str(formData, "token");
  const result = await bookSetupSlot(token, new Date(str(formData, "at")));
  redirect(`/setup/${encodeURIComponent(token)}?r=${result}`);
}

export async function cancelSetupSession(formData: FormData) {
  const token = str(formData, "token");
  await cancelSetupSlot(token, str(formData, "bookingId"));
  redirect(`/setup/${encodeURIComponent(token)}?r=cancelled`);
}

/** Operator: send or re-send the offer to one account. */
export async function adminSendSetupOffer(formData: FormData) {
  if (!(await isOperator())) return;
  const userId = str(formData, "userId");
  if (userId) await sendSetupOffer(userId, formData.get("again") === "1").catch(() => false);
  revalidatePath("/admin/setup");
}

/** Operator: send the offer to every account that has not had one yet. */
export async function adminSendSetupOfferToAll() {
  if (!(await isOperator())) return;
  const [users, sent] = await Promise.all([
    prisma.user.findMany({
      where: { flaggedAt: null, email: { notIn: operatorEmails() } },
      select: { id: true },
    }),
    prisma.outreachSend.findMany({
      where: { emailKey: SETUP_OFFER_KEY },
      select: { userId: true },
    }),
  ]);
  const done = new Set(sent.map((i) => i.userId));
  for (const u of users) {
    if (!done.has(u.id)) await sendSetupOffer(u.id).catch(() => false);
  }
  revalidatePath("/admin/setup");
}

/** Operator: email yourself a working copy to click through. Not recorded as a send. */
export async function adminSendSetupTest() {
  if (!(await isOperator())) return;
  const session = await getSession();
  if (session?.user.id) await sendSetupOffer(session.user.id, false, true).catch(() => false);
  revalidatePath("/admin/setup");
}
