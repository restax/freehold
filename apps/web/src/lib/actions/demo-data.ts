"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  findDemoOrg,
  redateDemoWorkspace,
  seedDemoWorkspace,
  wipeDemoWorkspace,
} from "@/lib/demo-workspace";
import { isOperator } from "@/lib/operator";
import { getSession } from "@/lib/session";

/**
 * Operator controls for the recorded-demo dataset (lib/demo-workspace.ts).
 * Every one of these re-checks isOperator() itself rather than trusting the
 * page that rendered the button — the page gate stops the buttons being
 * *seen*, this stops them being *called*.
 */

async function operatorUserId(): Promise<string | null> {
  if (!(await isOperator())) return null;
  const session = await getSession();
  return session?.user.id ?? null;
}

/** Refresh every surface the demo data shows up on. */
function revalidateDemoSurfaces() {
  revalidatePath("/admin/demo-data");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/invoices");
}

export async function loadDemoData() {
  const userId = await operatorUserId();
  if (!userId) return;
  const org = await findDemoOrg();
  if (!org) redirect("/admin/demo-data?error=noworkspace");

  try {
    await seedDemoWorkspace(org.id, userId);
  } catch (err) {
    console.error("loadDemoData failed", err);
    redirect("/admin/demo-data?error=seed");
  }
  revalidateDemoSurfaces();
  redirect("/admin/demo-data?done=loaded");
}

export async function redateDemoData() {
  const userId = await operatorUserId();
  if (!userId) return;
  const org = await findDemoOrg();
  if (!org) redirect("/admin/demo-data?error=noworkspace");

  let shifted = 0;
  try {
    shifted = await redateDemoWorkspace(org.id);
  } catch (err) {
    console.error("redateDemoData failed", err);
    redirect("/admin/demo-data?error=redate");
  }
  revalidateDemoSurfaces();
  redirect(`/admin/demo-data?done=redated&days=${shifted}`);
}

export async function wipeDemoData() {
  const userId = await operatorUserId();
  if (!userId) return;
  const org = await findDemoOrg();
  if (!org) redirect("/admin/demo-data?error=noworkspace");

  try {
    await wipeDemoWorkspace(org.id);
  } catch (err) {
    console.error("wipeDemoData failed", err);
    redirect("/admin/demo-data?error=wipe");
  }
  revalidateDemoSurfaces();
  redirect("/admin/demo-data?done=wiped");
}
