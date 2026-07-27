"use server";

import { randomBytes } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import {
  isEmailish,
  LOOKUP_LIMIT,
  LOOKUP_WINDOW_MINUTES,
  linkExpiry,
  normalizeEmail,
} from "@/lib/form-access";
import { hashSource, publicFormBase, sourceIp } from "@/lib/public-request";

/**
 * "Is this address already one of yours?" — the first step of a public
 * intake form.
 *
 * A returning client gets an emailed link that opens the form with their
 * details already in it, so they never retype their business. A stranger is
 * simply shown the form.
 *
 * The honest answer here is also the risky one: told apart, the two
 * outcomes let someone probe who a workspace's clients are. Two things keep
 * that in check — every attempt is counted, hit or miss (a limiter that
 * only counted hits would be no limiter at all), and the link goes to the
 * address on file rather than to whoever asked, so a prober learns nothing
 * they can act on.
 */

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function identifyForForm(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const formSlug = String(formData.get("formSlug") ?? "");
  const emailRaw = String(formData.get("email") ?? "");
  // Honeypot, same as the submission path.
  if (String(formData.get("company_website") ?? "")) return;
  if (!orgSlug || !formSlug) return;

  // Annotated `never` so the compiler knows control stops here — otherwise
  // everything after a bounce reads as still-reachable.
  const back = (q: string): never => redirect(`/t/${orgSlug}/f/${formSlug}?${q}`);
  if (!isEmailish(emailRaw)) return back("bademail=1");
  const email = normalizeEmail(emailRaw);

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true },
  });
  if (!org) return;

  const form = await withTenant(org.id, (tx) => tx.form.findFirst({ where: { slug: formSlug } }));
  if (form?.status !== "published" || !form.showPublic) return;

  // Count the attempt before answering, whatever the outcome.
  const ipHash = hashSource(await sourceIp(), org.id);
  const since = new Date(Date.now() - LOOKUP_WINDOW_MINUTES * 60_000);
  const attempts = await withTenant(org.id, async (tx) => {
    const n = await tx.formLookupAttempt.count({ where: { ipHash, createdAt: { gte: since } } });
    await tx.formLookupAttempt.create({ data: { tenantId: org.id, ipHash } });
    return n;
  });
  if (attempts >= LOOKUP_LIMIT) return back("tooMany=1");

  const client = await withTenant(org.id, (tx) =>
    tx.client.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true },
    }),
  );

  // Not a client: let them fill the form in right here, no round trip.
  if (!client) return back(`new=1&email=${encodeURIComponent(email)}`);

  // A client, but this install can't send mail — don't strand them.
  if (!emailEnabled()) return back(`new=1&email=${encodeURIComponent(email)}`);

  const token = newToken();
  await withTenant(org.id, (tx) =>
    tx.formAccessLink.create({
      data: {
        tenantId: org.id,
        formId: form.id,
        clientId: client.id,
        email,
        token,
        expiresAt: linkExpiry(),
      },
    }),
  );

  const url = `${await publicFormBase(org.id)}/fl/${token}`;
  await sendTenantEmail({
    tenantId: org.id,
    to: email,
    subject: `Your ${form.title.toLowerCase()} link — ${org.name}`,
    body: [
      `Hello,`,
      ``,
      `Here is your link to ${form.title.toLowerCase()} with ${org.name}. Your details are already filled in, so there's nothing to sign in to:`,
      ``,
      url,
      ``,
      `The link works for the next three days. If you didn't ask for it, you can ignore this message — nothing happens until the form is sent.`,
      ``,
      `— ${org.name}`,
    ].join("\n"),
  });

  return back(`sentLink=1&email=${encodeURIComponent(email)}`);
}
