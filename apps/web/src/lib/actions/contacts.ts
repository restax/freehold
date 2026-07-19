"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import {
  type Address,
  displayName,
  GRADES,
  type MonthDay,
  nextTouchFrom,
  type PersonFields,
  type TouchDates,
} from "@/lib/crm";
import { confirmed, optStr, str } from "@/lib/forms";
import { requireAdminTenant, requireTenant } from "@/lib/tenant";

function person(formData: FormData, prefix: string): PersonFields | null {
  const p: PersonFields = {
    title: optStr(formData, `${prefix}Title`) ?? undefined,
    first: optStr(formData, `${prefix}First`) ?? undefined,
    middle: optStr(formData, `${prefix}Middle`) ?? undefined,
    last: optStr(formData, `${prefix}Last`) ?? undefined,
    jobTitle: optStr(formData, `${prefix}JobTitle`) ?? undefined,
    cell: optStr(formData, `${prefix}Cell`) ?? undefined,
    workPhone: optStr(formData, `${prefix}WorkPhone`) ?? undefined,
    email: optStr(formData, `${prefix}Email`) ?? undefined,
  };
  return Object.values(p).some(Boolean) ? p : null;
}

function address(formData: FormData, prefix: string): Address | null {
  const a: Address = {
    line1: optStr(formData, `${prefix}Line1`) ?? undefined,
    line2: optStr(formData, `${prefix}Line2`) ?? undefined,
    city: optStr(formData, `${prefix}City`) ?? undefined,
    state: optStr(formData, `${prefix}State`) ?? undefined,
    zip: optStr(formData, `${prefix}Zip`) ?? undefined,
  };
  return Object.values(a).some(Boolean) ? a : null;
}

function monthDay(formData: FormData, prefix: string): MonthDay | undefined {
  const m = Number(str(formData, `${prefix}M`));
  const d = Number(str(formData, `${prefix}D`));
  const y = Number(str(formData, `${prefix}Y`));
  if (!m || !d) return undefined;
  return { m, d, ...(y ? { y } : {}) };
}

function listOf(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((v) => String(v).trim())
    .filter(Boolean);
}

/** Shared FormData → Contact fields parse for create and update. */
function parseContactForm(formData: FormData) {
  const primary = person(formData, "p") ?? {};
  const secondary = person(formData, "s");

  const categories = [
    ...listOf(formData, "categories"),
    ...(optStr(formData, "newCategory")?.split(",") ?? []),
  ]
    .map((c) => c.trim())
    .filter(Boolean);

  const gradeRaw = str(formData, "grade");
  const grade = (GRADES as readonly string[]).includes(gradeRaw) ? gradeRaw : null;

  const touchDates: TouchDates = {
    birthday: monthDay(formData, "birthday"),
    birthdayAlt: monthDay(formData, "birthdayAlt"),
    weddingAnniversary: monthDay(formData, "wedding"),
    purchaseAnniversary: monthDay(formData, "purchase"),
  };

  const leadTypeRaw = str(formData, "leadType");
  const leadType = ["BUYER", "SELLER", "NONE"].includes(leadTypeRaw) ? leadTypeRaw : null;
  const leadDetails =
    leadType === "BUYER"
      ? {
          cultivating: optStr(formData, "buyerCultivating"),
          location: optStr(formData, "buyerLocation"),
          range: optStr(formData, "buyerRange"),
          income: optStr(formData, "buyerIncome"),
        }
      : leadType === "SELLER"
        ? {
            cultivating: optStr(formData, "sellerCultivating"),
            address: optStr(formData, "sellerAddress"),
            listPrice: optStr(formData, "sellerListPrice"),
            netProceeds: optStr(formData, "sellerNetProceeds"),
          }
        : null;

  const extraPhones = listOf(formData, "extraPhone");
  const extraEmails = listOf(formData, "extraEmail");

  const referralKind = str(formData, "referralKind"); // "contact" | "source"
  const referredById = referralKind === "contact" ? optStr(formData, "referredById") : null;
  const referralSource = referralKind === "source" ? optStr(formData, "referralSource") : null;
  const referralDateRaw = optStr(formData, "referralDate");

  const name = displayName(primary, secondary, "") || str(formData, "name") || "Unnamed contact";

  const socialLinks = {
    facebook: optStr(formData, "socialFacebook") ?? undefined,
    instagram: optStr(formData, "socialInstagram") ?? undefined,
    linkedin: optStr(formData, "socialLinkedin") ?? undefined,
    x: optStr(formData, "socialX") ?? undefined,
    youtube: optStr(formData, "socialYoutube") ?? undefined,
    other: optStr(formData, "socialOther") ?? undefined,
  };

  type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
  const asJson = <T>(v: T | null | undefined) =>
    v == null ? undefined : (JSON.parse(JSON.stringify(v)) as { [k: string]: Json });

  return {
    name,
    personTitle: primary.title ?? null,
    firstName: primary.first ?? null,
    middleName: primary.middle ?? null,
    lastName: primary.last ?? null,
    jobTitle: primary.jobTitle ?? null,
    company: optStr(formData, "company"),
    website: optStr(formData, "website"),
    phone: primary.cell ?? null,
    workPhone: primary.workPhone ?? null,
    fax: optStr(formData, "fax"),
    email: primary.email ?? null,
    secondary: asJson(secondary),
    extraContacts:
      extraPhones.length || extraEmails.length
        ? { phones: extraPhones, emails: extraEmails }
        : undefined,
    categories,
    grade,
    homeAddress: asJson(address(formData, "home")),
    workAddress: asJson(address(formData, "work")),
    referredById,
    referralSource,
    referralDate: referralDateRaw ? new Date(`${referralDateRaw}T00:00:00Z`) : null,
    leadType,
    leadDetails: asJson(leadDetails),
    touchDates: Object.values(touchDates).some(Boolean) ? asJson(touchDates) : undefined,
    photoUrl: optStr(formData, "photoUrl"),
    socialLinks: Object.values(socialLinks).some(Boolean) ? asJson(socialLinks) : undefined,
    ownerId: optStr(formData, "ownerId"),
  };
}

export async function createContact(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const fields = parseContactForm(formData);
  const created = await withTenant(tenantId, (tx) =>
    tx.contact.create({
      data: {
        tenantId,
        ...fields,
        ownerId: fields.ownerId ?? userId,
        nextTouchAt: nextTouchFrom(fields.grade),
      },
    }),
  );
  revalidatePath("/dashboard/contacts");
  redirect(`/dashboard/contacts/${created.id}`);
}

export async function updateContact(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const fields = parseContactForm(formData);
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.contact.findUniqueOrThrow({
      where: { id },
      select: { grade: true },
    });
    await tx.contact.update({
      where: { id },
      data: {
        ...fields,
        // Grade changes restart the prospecting clock; same grade keeps it.
        ...(existing.grade !== fields.grade ? { nextTouchAt: nextTouchFrom(fields.grade) } : {}),
      },
    });
  });
  revalidatePath(`/dashboard/contacts/${id}`);
  revalidatePath("/dashboard/contacts");
  redirect(`/dashboard/contacts/${id}`);
}

/** Quick note from the contact detail screen. */
export async function addContactNote(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const contactId = str(formData, "contactId");
  const body = str(formData, "body");
  if (!contactId || !body) return;
  await withTenant(tenantId, (tx) =>
    tx.contactNote.create({ data: { tenantId, contactId, authorId: userId, body } }),
  );
  revalidatePath(`/dashboard/contacts/${contactId}`);
}

const FOLLOW_UP_DAYS: Record<string, number> = {
  "3d": 3,
  "1w": 7,
  "2w": 14,
  "30d": 30,
};

/** Follow-up scheduler: creates a contact-linked task due in N days. */
export async function scheduleFollowUp(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const contactId = str(formData, "contactId");
  const contactName = str(formData, "contactName");
  const when = str(formData, "when");
  const custom = optStr(formData, "customDate");
  if (!contactId) return;
  let dueDate: Date | null = null;
  if (when === "custom" && custom) {
    dueDate = new Date(`${custom}T00:00:00Z`);
  } else if (FOLLOW_UP_DAYS[when]) {
    dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + FOLLOW_UP_DAYS[when]);
  }
  if (!dueDate) return;
  await withTenant(tenantId, (tx) =>
    tx.task.create({
      data: {
        tenantId,
        contactId,
        title: `Follow up: ${contactName || "contact"}`,
        dueDate,
        assigneeId: userId,
      },
    }),
  );
  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard");
}

/** "Touched today": resets the auto-prospecting clock from now. */
export async function logTouch(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const contactId = str(formData, "contactId");
  if (!contactId) return;
  await withTenant(tenantId, async (tx) => {
    const c = await tx.contact.findUniqueOrThrow({
      where: { id: contactId },
      select: { grade: true },
    });
    await tx.contact.update({
      where: { id: contactId },
      data: { touchDate: new Date(), nextTouchAt: nextTouchFrom(c.grade) },
    });
    await tx.contactNote.create({
      data: { tenantId, contactId, authorId: userId, body: "Touch logged." },
    });
  });
  revalidatePath(`/dashboard/contacts/${contactId}`);
  revalidatePath("/dashboard/contacts");
}

/** Admin setting: members only see contacts they own. */
export async function setContactVisibilityRestriction(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const restrict = str(formData, "restrict") === "1";
  await withTenant(tenantId, () => Promise.resolve()); // tenant check only
  const { prisma } = await import("@freehold/db");
  await prisma.organization.update({
    where: { id: tenantId },
    data: { restrictContactsToOwner: restrict },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "settings.contact_visibility",
    summary: restrict
      ? "Restricted contact visibility: members now see only contacts they own"
      : "Opened contact visibility: members see all contacts",
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/contacts");
}

export async function deleteContact(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  const gone = await withTenant(tenantId, (tx) =>
    tx.contact.delete({ where: { id }, select: { name: true } }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "contact.deleted",
    summary: `Deleted contact "${gone.name}"`,
    subjectType: "contact",
    subjectId: id,
  });
  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}
