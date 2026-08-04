"use server";

import { prisma } from "@freehold/db";
import { redirect } from "next/navigation";
import {
  extractLeadFromImage,
  fullName,
  hasAnyField,
  isSupportedImageType,
  type LeadFields,
} from "@/lib/ai/lead-capture";
import { optStr } from "@/lib/forms";
import { isOperator } from "@/lib/operator";
import {
  findOrCreateTwentyCompany,
  linkTwentyPersonToCompany,
  loadTwentyConnection,
  sendTwentyLead,
} from "@/lib/twenty";

/** Where the Twenty connection for operator-side capture lives — the same
 *  real workspace the recommend composer pushes into. */
const CRM_SOURCE_ORG_SLUG = "acme-brokers-inc";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matching document upload

/**
 * Read a pasted screenshot and hand the extracted fields back to the page as
 * query params, so the review form is prefilled without persisting anything.
 * Nothing reaches the CRM here: extraction and saving are deliberately two
 * steps, because a vision model misreading a phone number should be caught by
 * a human, not written straight into a contact record.
 */
export async function extractLead(formData: FormData) {
  if (!(await isOperator())) return;

  const file = formData.get("screenshot");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/crm-capture?error=nofile");
  }
  if (file.size > MAX_BYTES) {
    redirect("/admin/crm-capture?error=toobig");
  }
  if (!isSupportedImageType(file.type)) {
    redirect("/admin/crm-capture?error=type");
  }

  let lead: LeadFields;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    ({ lead } = await extractLeadFromImage(buf, file.type));
  } catch (err) {
    console.error("extractLead: extraction failed", err);
    redirect("/admin/crm-capture?error=extract");
  }

  if (!hasAnyField(lead)) {
    redirect("/admin/crm-capture?error=empty");
  }

  const qs = new URLSearchParams({ found: "1" });
  for (const [k, v] of Object.entries(lead)) {
    if (v) qs.set(k, v);
  }
  redirect(`/admin/crm-capture?${qs.toString()}`);
}

/**
 * Save the reviewed fields to Twenty. The company (when given) is found or
 * created first, then linked to the new person — Twenty models company as its
 * own object, so there is no single call that does both.
 */
export async function saveLeadToCrm(formData: FormData) {
  if (!(await isOperator())) return;

  const firstName = optStr(formData, "firstName") ?? "";
  const lastName = optStr(formData, "lastName") ?? "";
  const phone = optStr(formData, "phone");
  const email = optStr(formData, "email");
  const company = optStr(formData, "company");

  const name = fullName({ firstName: firstName || null, lastName: lastName || null });
  // A company-only capture is still worth saving, but Twenty's Person needs
  // some name, so fall back to the company for the person record.
  const personName = name ?? company;
  if (!personName) {
    redirect("/admin/crm-capture?error=noname");
  }

  const org = await prisma.organization.findFirst({
    where: { slug: CRM_SOURCE_ORG_SLUG },
    select: { id: true },
  });
  const conn = org ? await loadTwentyConnection(org.id) : null;
  if (!conn) {
    console.error("saveLeadToCrm: no Twenty connection for", CRM_SOURCE_ORG_SLUG);
    redirect("/admin/crm-capture?error=noconn");
  }

  const person = await sendTwentyLead(conn, { name: personName, email, phone });
  if (!person.ok) {
    redirect("/admin/crm-capture?error=save");
  }

  // Company linking is best-effort: the person is already in the CRM, so a
  // company failure is reported as a partial success rather than an error.
  let companyLinked = false;
  if (company && person.id) {
    const co = await findOrCreateTwentyCompany(conn, company);
    if (co) companyLinked = await linkTwentyPersonToCompany(conn, person.id, co.id);
  }

  const saved = company && !companyLinked ? "partial" : "1";
  redirect(`/admin/crm-capture?saved=${saved}`);
}
