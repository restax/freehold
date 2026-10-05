"use server";

import { billingEnabled, createCardCheck } from "@freehold/ee-billing";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearFlag, flagAccount, sendFlagEmail, userForFlagToken } from "@/lib/account-flags";
import { optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";

function baseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3010").replace(/\/+$/, "");
}

/** Public (no session: sign-in is suspended). The token is the authority. */
export async function startCardCheck(formData: FormData) {
  const token = str(formData, "token");
  const user = await userForFlagToken(token);
  if (!user || !billingEnabled()) redirect(`/verify-account/${encodeURIComponent(token)}`);
  const page = `${baseUrl()}/verify-account/${encodeURIComponent(token)}`;
  const { url } = await createCardCheck({
    userId: user.id,
    email: user.email,
    successUrl: `${page}?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: page,
  });
  redirect(url);
}

/** Operator: flag an account (stops sign-in, emails the person). */
export async function adminFlagAccount(formData: FormData) {
  if (!(await isOperator())) return;
  const userId = str(formData, "userId");
  if (!userId) return;
  await flagAccount(userId, optStr(formData, "reason"));
  revalidateSignups();
}

/** Operator: clear a flag by hand, e.g. after reading the person's reply. */
export async function adminClearFlag(formData: FormData) {
  if (!(await isOperator())) return;
  const userId = str(formData, "userId");
  if (!userId) return;
  await clearFlag(userId, "operator");
  revalidateSignups();
}

/** Operator: send the email again with a fresh link. */
export async function adminResendFlagEmail(formData: FormData) {
  if (!(await isOperator())) return;
  const userId = str(formData, "userId");
  if (!userId) return;
  await sendFlagEmail(userId).catch(() => false);
  revalidateSignups();
}

function revalidateSignups() {
  revalidatePath("/admin/signups");
}
