"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { optStr, str } from "@/lib/forms";
import { loadFubKey, sendFubLead } from "@/lib/fub";
import { parseSiteConfig, type TenantSiteConfig } from "@/lib/site-config";
import { requireAdminTenant } from "@/lib/tenant";
import { loadTwentyConnection, sendTwentyLead } from "@/lib/twenty";

export async function saveSiteConfig(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const config: TenantSiteConfig = {
    published: formData.get("published") === "on",
    showRegistration: formData.get("showRegistration") === "on",
    tagline: optStr(formData, "tagline") ?? undefined,
    about: optStr(formData, "about") ?? undefined,
    phone: optStr(formData, "phone") ?? undefined,
    email: optStr(formData, "email") ?? undefined,
    services: optStr(formData, "services") ?? undefined,
  };
  // Logo: small raster image stored inline as a data URL on org.logo — no
  // storage bucket required, works identically on Cloud and self-host.
  let logo: string | null | undefined;
  if (formData.get("removeLogo") === "on") {
    logo = null;
  } else {
    const file = formData.get("logo");
    if (file instanceof File && file.size > 0) {
      const okType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
      if (okType && file.size <= 1_000_000) {
        const buf = Buffer.from(await file.arrayBuffer());
        logo = `data:${file.type};base64,${buf.toString("base64")}`;
      }
    }
  }

  const org = await prisma.organization.update({
    where: { id: tenantId },
    data: {
      siteConfig: JSON.parse(JSON.stringify(config)),
      ...(logo !== undefined ? { logo } : {}),
    },
    select: { slug: true },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "website.updated",
    summary: config.published ? "Updated and published the website" : "Updated the website (draft)",
  });
  revalidatePath("/dashboard/website");
  revalidatePath(`/t/${org.slug}`);
}

/**
 * Public new-client registration from a tenant's website. No session — the
 * tenant is identified by slug, and the form only works while the site is
 * published with registration on. A filled honeypot field drops the
 * submission silently.
 */
export async function submitTenantLead(formData: FormData) {
  const slug = str(formData, "slug");
  const name = str(formData, "name");
  const email = optStr(formData, "email");
  const phone = optStr(formData, "phone");
  const interest = str(formData, "interest");
  const message = optStr(formData, "message");
  const honeypot = optStr(formData, "company_website");
  if (!slug || !name || honeypot) return;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, siteConfig: true },
  });
  const site = parseSiteConfig(org?.siteConfig);
  if (!org || !site.published || !site.showRegistration) return;

  const leadType = interest === "BUYER" ? "BUYER" : interest === "SELLER" ? "SELLER" : null;
  await withTenant(org.id, async (tx) => {
    const contact = await tx.contact.create({
      data: {
        tenantId: org.id,
        name: name.slice(0, 200),
        email,
        phone,
        category: "Website Lead",
        categories: ["Website Lead"],
        leadType,
        notes: message ? `Website registration: ${message.slice(0, 2000)}` : null,
      },
    });
    await tx.task.create({
      data: {
        tenantId: org.id,
        contactId: contact.id,
        title: `New website lead: ${contact.name}`,
        dueDate: new Date(),
        priority: "HIGH",
      },
    });
  });
  // Connected Follow Up Boss accounts get the lead too, through the events
  // API so the tenant's FUB automations fire. Fire-and-forget.
  loadFubKey(org.id)
    .then((key) => (key ? sendFubLead(key, { name, email, phone, message }) : undefined))
    .catch(() => {});
  loadTwentyConnection(org.id)
    .then((conn) => (conn ? sendTwentyLead(conn, { name, email, phone }) : undefined))
    .catch(() => {});

  // On the subdomain the site lives at "/"; direct apex previews at /t/<slug>.
  const host = (await headers()).get("host") ?? "";
  redirect(host.startsWith(`${slug}.`) ? "/?thanks=1" : `/t/${slug}?thanks=1`);
}

/** The /example-site demo form: nothing is stored, just the thanks state. */
export async function submitExampleLead(formData: FormData) {
  optStr(formData, "noop");
  redirect("/example-site?thanks=1");
}

/** Workspace wording for transaction sides (buy side / sell side / list side…). */
export async function saveSideLabels(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const buy = optStr(formData, "buyLabel")?.slice(0, 30);
  const sell = optStr(formData, "sellLabel")?.slice(0, 30);
  await prisma.organization.update({
    where: { id: tenantId },
    data: { sideLabels: { buy: buy ?? "Buy side", sell: sell ?? "Sell side" } },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "settings.side_labels",
    summary: `Side wording set to "${buy ?? "Buy side"}" / "${sell ?? "Sell side"}"`,
  });
  revalidatePath("/dashboard", "layout");
}
