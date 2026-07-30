"use server";

import { DateAnchor, withTenant } from "@freehold/db";
import { anchorDate } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeKeyDate } from "@/lib/actions/transactions";
import { logActivity } from "@/lib/activity";
import {
  enabledHolidayKeys,
  holidaySetAround,
  resolveCalculatedDate,
} from "@/lib/date-calculators";
import { confirmed, dateOnly, intOr, optStr, str } from "@/lib/forms";
import { isKeyDateField, type KeyDateField } from "@/lib/governed-dates";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

const ANCHORS = new Set(Object.values(DateAnchor));

/** Unlike `oneOf`, an unset or unrecognized anchor here means "no suggestion
 *  — entered manually", not a fallback value. */
function optAnchor(formData: FormData, key: string): DateAnchor | null {
  const v = str(formData, key);
  return (ANCHORS.has(v as DateAnchor) ? v : null) as DateAnchor | null;
}

/**
 * Named sets of key dates ("Contract dates") with a suggested calculator per
 * date. Applying one proposes computed values on a transaction — the TC
 * confirms or overrides every one; nothing here writes a date directly.
 */

export async function createDateTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const name = str(formData, "name");
  if (!name) return;
  const created = await withTenant(tenantId, (tx) =>
    tx.dateTemplate.create({
      data: {
        tenantId,
        name,
        description: optStr(formData, "description"),
        groupId: optStr(formData, "groupId"),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
  redirect(`/dashboard/templates?tab=dates&dateId=${created.id}`);
}

export async function updateDateTemplate(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) =>
    tx.dateTemplate.update({
      where: { id },
      data: {
        name: str(formData, "name") || undefined,
        description: optStr(formData, "description"),
        groupId: optStr(formData, "groupId"),
      },
    }),
  );
  revalidatePath("/dashboard/templates");
}

export async function addDateTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const dateTemplateId = str(formData, "dateTemplateId");
  const dateKey = str(formData, "dateKey");
  const label = str(formData, "label");
  if (!dateTemplateId || !dateKey || !label) return;
  await withTenant(tenantId, async (tx) => {
    const max = await tx.dateTemplateItem.aggregate({
      where: { dateTemplateId },
      _max: { sortOrder: true },
    });
    await tx.dateTemplateItem.create({
      data: {
        tenantId,
        dateTemplateId,
        dateKey,
        label,
        anchor: optAnchor(formData, "anchor"),
        offsetDays: intOr(formData, "offsetDays", null),
        calculator: optStr(formData, "calculator"),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  });
  revalidatePath("/dashboard/templates");
}

export async function deleteDateTemplateItem(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  await withTenant(tenantId, (tx) => tx.dateTemplateItem.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
}

export async function deleteDateTemplate(formData: FormData) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const id = str(formData, "id");
  if (!id || !isAdmin || !confirmed(formData)) return;
  await withTenant(tenantId, (tx) => tx.dateTemplate.delete({ where: { id } }));
  revalidatePath("/dashboard/templates");
  redirect("/dashboard/templates?tab=dates");
}

/**
 * Every item's suggested value for one transaction, so the transaction page
 * can show a confirm-and-edit form rather than writing dates unseen. Nothing
 * here touches the database — an item whose `dateKey` isn't a real Key dates
 * field, or whose anchor has no date on this file yet, just comes back
 * without a suggestion, and the TC fills it in by hand.
 */
export async function previewDateTemplate(
  tenantId: string,
  transactionId: string,
  dateTemplateId: string,
): Promise<Array<{ id: string; dateKey: string; label: string; suggested: string | null }>> {
  const [template, txn, org] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.dateTemplate.findUniqueOrThrow({
        where: { id: dateTemplateId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      }),
      tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
        select: {
          contractDate: true,
          closeDate: true,
          listDate: true,
          expireDate: true,
          mortgageCommitmentDate: true,
          inspectionDeadlineDate: true,
          earnestMoneyDueDate: true,
        },
      }),
      tx.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { holidaySchedule: true },
      }),
    ]),
  );
  const holidays = holidaySetAround(new Date(), enabledHolidayKeys(org.holidaySchedule));

  return template.items.map((item) => {
    if (!item.anchor || item.offsetDays == null) {
      return { id: item.id, dateKey: item.dateKey, label: item.label, suggested: null };
    }
    const base = anchorDate(item.anchor, { ...txn, templateStart: new Date() });
    if (!base) return { id: item.id, dateKey: item.dateKey, label: item.label, suggested: null };
    const suggested = resolveCalculatedDate(base, item.offsetDays, item.calculator, holidays);
    return {
      id: item.id,
      dateKey: item.dateKey,
      label: item.label,
      suggested: suggested.toISOString().slice(0, 10),
    };
  });
}

/**
 * Write the confirmed (possibly hand-edited) values back onto the
 * transaction, one column each, through the exact rule the Key dates panel
 * uses — a contract-governed field still proposes rather than applies.
 */
export async function applyDateTemplateValues(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const dateTemplateId = str(formData, "dateTemplateId");
  if (!transactionId || !dateTemplateId) return;

  const dateKeys = formData.getAll("dateKey").map(String);
  let written = 0;
  let proposed = 0;
  await withTenant(tenantId, async (tx) => {
    for (const key of dateKeys) {
      if (!isKeyDateField(key)) continue;
      const value = dateOnly(formData, `value:${key}`);
      if (!value) continue;
      const { proposedValue } = await writeKeyDate(
        tx,
        tenantId,
        session.user.id,
        transactionId,
        key as KeyDateField,
        value,
      );
      if (proposedValue) proposed++;
      else written++;
    }
  });

  const template = await withTenant(tenantId, (tx) =>
    tx.dateTemplate.findUnique({ where: { id: dateTemplateId }, select: { name: true } }),
  );
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "date_template.applied",
    summary: `Applied "${template?.name ?? "a key-dates template"}" — ${written} date${written === 1 ? "" : "s"} set${proposed > 0 ? `, ${proposed} proposed as amendment${proposed === 1 ? "" : "s"}` : ""}`,
  });
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}
