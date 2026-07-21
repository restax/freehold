"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/lib/forms";
import { unsubscribeAdRenewal } from "@/lib/vendor-ad-renewals";

/**
 * One-click unsubscribe from ad renewal reminders. The token from the email is
 * the whole capability — no login. We resolve it to its ad and stamp it
 * unsubscribed; nothing else is exposed or mutated.
 */
export async function unsubscribeAdRenewalAction(formData: FormData) {
  const token = str(formData, "token");
  await unsubscribeAdRenewal(token);
  revalidatePath(`/ad-renewal/${token}`);
}
