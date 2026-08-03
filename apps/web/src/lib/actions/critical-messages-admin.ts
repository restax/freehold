"use server";

import { prisma } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { confirmed, oneOf, optStr, str } from "@/lib/forms";
import { isOperator } from "@/lib/operator";

const TRIGGERS = [
  "IMMEDIATE",
  "HAS_SAMPLE_DATA",
  "FIFTH_REAL_TRANSACTION",
  "DAYS_AFTER_MESSAGE",
] as const;

/** Shared field parsing for create/update — same shape both times. */
function fieldsFrom(formData: FormData) {
  const trigger = oneOf(formData, "trigger", TRIGGERS, "IMMEDIATE");
  const linkUrl = optStr(formData, "linkUrl");
  return {
    title: str(formData, "title"),
    body: str(formData, "body"),
    linkUrl: linkUrl && /^https?:\/\//.test(linkUrl) ? linkUrl : null,
    urgent: formData.get("urgent") === "on",
    trigger,
    triggerDelayDays:
      trigger === "DAYS_AFTER_MESSAGE" ? optStr(formData, "triggerDelayDays") : null,
    triggerAfterMessageId:
      trigger === "DAYS_AFTER_MESSAGE" ? optStr(formData, "triggerAfterMessageId") : null,
  };
}

export async function createCriticalMessage(formData: FormData) {
  if (!(await isOperator())) return;
  const f = fieldsFrom(formData);
  if (!f.title || !f.body) return;
  await prisma.criticalMessage.create({
    data: {
      title: f.title,
      body: f.body,
      linkUrl: f.linkUrl,
      urgent: f.urgent,
      trigger: f.trigger,
      triggerDelayDays: f.triggerDelayDays ? Number.parseInt(f.triggerDelayDays, 10) : null,
      triggerAfterMessageId: f.triggerAfterMessageId,
    },
  });
  revalidatePath("/admin/messages");
}

export async function updateCriticalMessage(formData: FormData) {
  if (!(await isOperator())) return;
  const id = str(formData, "id");
  if (!id) return;
  const f = fieldsFrom(formData);
  if (!f.title || !f.body) return;
  await prisma.criticalMessage.update({
    where: { id },
    data: {
      title: f.title,
      body: f.body,
      linkUrl: f.linkUrl,
      urgent: f.urgent,
      trigger: f.trigger,
      triggerDelayDays: f.triggerDelayDays ? Number.parseInt(f.triggerDelayDays, 10) : null,
      triggerAfterMessageId: f.triggerAfterMessageId,
    },
  });
  revalidatePath("/admin/messages");
}

export async function deleteCriticalMessage(formData: FormData) {
  if (!(await isOperator())) return;
  if (!confirmed(formData)) return;
  const id = str(formData, "id");
  if (!id) return;
  await prisma.criticalMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
}
