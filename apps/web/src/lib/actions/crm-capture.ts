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
  findTwentyDuplicates,
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
 *
 * Duplicates are re-checked here against the values actually submitted, not
 * just the ones the page checked at render time, because the form is
 * editable. Finding a match sends the form back with a warning instead of
 * saving; a second submit carrying confirm=1 is what actually writes.
 */
export async function saveLeadToCrm(formData: FormData) {
  if (!(await isOperator())) return;

  const firstName = optStr(formData, "firstName") ?? "";
  const lastName = optStr(formData, "lastName") ?? "";
  const phone = optStr(formData, "phone");
  const email = optStr(formData, "email");
  const company = optStr(formData, "company");
  const confirmed = optStr(formData, "confirm") === "1";

  const name = fullName({ firstName: firstName || null, lastName: lastName || null });
  // A company-only capture is still worth saving, but Twenty's Person needs
  // some name, so fall back to the company for the person record.
  const personName = name ?? company;

  /** Bounce back to the review form with the current values preserved. */
  function backToForm(extra: Record<string, string>): never {
    const qs = new URLSearchParams({ found: "1", ...extra });
    for (const [k, v] of Object.entries({ firstName, lastName, phone, email, company })) {
      if (v) qs.set(k, v);
    }
    redirect(`/admin/crm-capture?${qs.toString()}`);
  }

  if (!personName) {
    backToForm({ error: "noname" });
  }

  const org = await prisma.organization.findFirst({
    where: { slug: CRM_SOURCE_ORG_SLUG },
    select: { id: true },
  });
  const conn = org ? await loadTwentyConnection(org.id) : null;
  if (!conn) {
    console.error("saveLeadToCrm: no Twenty connection for", CRM_SOURCE_ORG_SLUG);
    backToForm({ error: "noconn" });
  }

  if (!confirmed) {
    const dup = await findTwentyDuplicates(conn, {
      email,
      phone,
      firstName: firstName || null,
      lastName: lastName || null,
    });
    // A failed lookup is reported as its own state, never as "no duplicates":
    // silently saving over a check that errored is exactly the duplicate this
    // is meant to catch.
    if (!dup.ok) backToForm({ dup: "unknown" });
    if (dup.matches.length > 0) backToForm({ dup: String(dup.matches.length) });
  }

  const person = await sendTwentyLead(conn, { name: personName, email, phone });
  if (!person.ok) {
    backToForm({ error: "save" });
  }

  // Company linking is best-effort: the person is already in the CRM, so a
  // company failure is reported as a partial success rather than an error.
  let companyLinked = false;
  if (company && person.id) {
    const co = await findOrCreateTwentyCompany(conn, company);
    if (co) companyLinked = await linkTwentyPersonToCompany(conn, person.id, co.id);
  }

  // What went in, and what didn't. Both are best-effort next to the person
  // record itself, and both have to be said out loud rather than assumed.
  const missed = [
    company && !companyLinked ? "company" : null,
    person.phoneDropped ? "phone" : null,
  ].filter(Boolean);

  const done = new URLSearchParams({ saved: "1" });
  if (missed.length > 0) done.set("missed", missed.join("-"));
  // The phone Twenty refused travels back so it can be shown, and copied,
  // without the operator having to find the screenshot again.
  if (person.phoneDropped && phone) done.set("phone", phone);
  redirect(`/admin/crm-capture?${done.toString()}`);
}
