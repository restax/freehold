"use server";

import { prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { logAudit } from "@/lib/audit";
import { customDomainError, normalizeCustomDomain } from "@/lib/domains";
import { optStr, str } from "@/lib/forms";
import { loadFubKey, sendFubLead } from "@/lib/fub";
import { normalizeHost, onTenantHost } from "@/lib/host-routing";
import {
  parseSiteBlocks,
  referencedImageIds,
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGE_TYPES,
  siteImageRef,
  siteImageUrl,
} from "@/lib/site-blocks";
import { parseSiteConfig, type TenantSiteConfig } from "@/lib/site-config";
import { deleteObject, putObject } from "@/lib/storage";
import { requireAdminTenant } from "@/lib/tenant";
import { loadTwentyConnection, sendTwentyLead } from "@/lib/twenty";
import {
  addVercelDomain,
  removeVercelDomain,
  vercelDomainAttached,
  vercelDomainStatus,
  vercelDomainsConfigured,
} from "@/lib/vercel-domains";

/**
 * The platform's own hostname. Kept here rather than in lib/domains.ts so that
 * module stays pure — it takes the root host as an argument instead of reading
 * the environment.
 */
function rootHostname(): string {
  try {
    return new URL(process.env.BETTER_AUTH_URL ?? "").host;
  } catch {
    return "freeholdtc.dev";
  }
}

export async function saveSiteConfig(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  // This form owns the flat fields; the block layout belongs to the designer
  // and is not in this payload. Rebuilding the config from the form alone
  // would silently delete a workspace's whole page layout on any content
  // edit, so the existing blocks are carried across untouched.
  const existing = parseSiteConfig(
    (
      await prisma.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { siteConfig: true },
      })
    ).siteConfig,
  );
  const config: TenantSiteConfig = {
    ...(existing.blocks ? { blocks: existing.blocks } : {}),
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
 * Save the page layout from the block designer.
 *
 * Takes JSON rather than FormData because the payload is a nested array the
 * client already holds in state — the same shape and the same reasoning as
 * saveFormLayout in actions/forms.ts. The layout is re-parsed and
 * re-normalised here: the designer maintains the invariants as a convenience,
 * this is the enforcement.
 */
export async function saveSiteBlocks(
  blocksJson: string,
): Promise<{ ok: true } | { error: string }> {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can edit the website." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(blocksJson);
  } catch {
    return { error: "That layout could not be read." };
  }
  const blocks = parseSiteBlocks(parsed);
  if (blocks.length === 0) {
    // An empty array would fall back to the legacy layout on read, so the
    // designer would appear to discard the save. Refuse instead of lying.
    return { error: "A page needs at least one block." };
  }

  const existing = parseSiteConfig(
    (
      await prisma.organization.findUniqueOrThrow({
        where: { id: tenantId },
        select: { siteConfig: true },
      })
    ).siteConfig,
  );
  const org = await prisma.organization.update({
    where: { id: tenantId },
    data: { siteConfig: JSON.parse(JSON.stringify({ ...existing, blocks })) },
    select: { slug: true },
  });

  // The layout is now the record of which uploads are in use, so this is the
  // one safe moment to drop the rest. Best-effort: failing to tidy up storage
  // must not fail the save the tenant actually asked for.
  await sweepSiteImages(tenantId, referencedImageIds(blocks)).catch(() => {});

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "website.updated",
    summary: `Rearranged the website (${blocks.length} block${blocks.length === 1 ? "" : "s"})`,
  });
  revalidatePath("/dashboard/website");
  revalidatePath("/site-preview");
  revalidatePath(`/t/${org.slug}`);
  return { ok: true };
}

/**
 * Point a domain the workspace owns at their public site.
 *
 * Two systems have to agree, and they're updated in this order deliberately:
 * Vercel first (it terminates TLS and has to accept the hostname at all), then
 * our row. If Vercel refuses, nothing is stored and the admin sees why. The
 * row starts "pending" — routing stays off until a check confirms the domain
 * actually resolves here, so typing a hostname is never enough to serve on it.
 */
export async function connectCustomDomain(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can change the domain." };
  if (!vercelDomainsConfigured()) {
    return { error: "Custom domains aren't available on this install." };
  }

  const domain = normalizeCustomDomain(str(formData, "domain"));
  const invalid = customDomainError(domain, normalizeHost(rootHostname()));
  if (invalid) return { error: invalid };

  // Our own uniqueness check first, for a message that names the real problem.
  // The unique index behind it is what actually makes this safe against a race.
  const taken = await prisma.organization.findFirst({
    where: { customDomain: domain, NOT: { id: tenantId } },
    select: { id: true },
  });
  if (taken) return { error: "Another workspace is already using that domain." };

  // Second layer, and the one that doesn't depend on env config being right:
  // anything already attached to the deployment is the platform's own or
  // another workspace's. Only a re-connect of this workspace's own domain is
  // allowed to be already attached.
  const mine = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { customDomain: true },
  });
  if (domain !== mine.customDomain) {
    const alreadyAttached = await vercelDomainAttached(domain).catch(() => false);
    if (alreadyAttached) return { error: "That domain isn't available." };
  }

  const added = await addVercelDomain(domain).catch(() => ({
    ok: false as const,
    error: "Couldn't reach our hosting provider. Try again in a minute.",
  }));
  if (!added.ok) return { error: added.error };

  try {
    await prisma.organization.update({
      where: { id: tenantId },
      data: { customDomain: domain, customDomainStatus: "pending", customDomainNote: null },
    });
  } catch {
    // Lost the race on the unique index. Hand the domain back rather than
    // leaving it attached to a project that isn't serving it.
    await removeVercelDomain(domain).catch(() => {});
    return { error: "Another workspace just claimed that domain." };
  }

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "website.domain_connected",
    summary: `Connected the domain ${domain}`,
  });
  revalidatePath("/dashboard/website");
  return { ok: true };
}

/**
 * Ask the domain provider where things stand and store the answer.
 *
 * Flipping to "active" is what actually turns routing on (publicTenantWhere
 * only matches active domains), so this is the gate between "an admin typed a
 * hostname" and "we serve a workspace's page on it".
 */
export async function checkCustomDomain(): Promise<{ ok: true } | { error: string }> {
  const { tenantId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can change the domain." };

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { customDomain: true },
  });
  if (!org.customDomain) return { error: "No domain is connected yet." };

  const status = await vercelDomainStatus(org.customDomain).catch(() => null);
  if (!status) return { error: "Couldn't reach our hosting provider. Try again in a minute." };

  const live = status.verified && !status.misconfigured;
  await prisma.organization.update({
    where: { id: tenantId },
    data: {
      customDomainStatus: live ? "active" : "pending",
      customDomainNote: status.note,
    },
  });
  revalidatePath("/dashboard/website");
  revalidatePath(`/t/${org.customDomain}`);
  return { ok: true };
}

/** Give the domain back. The workspace keeps serving on <slug>.<root>. */
export async function disconnectCustomDomain(): Promise<{ ok: true } | { error: string }> {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can change the domain." };

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { customDomain: true },
  });
  if (!org.customDomain) return { ok: true };

  // Clear our row first: whatever happens at the provider, this workspace
  // should stop claiming the name immediately.
  await prisma.organization.update({
    where: { id: tenantId },
    data: { customDomain: null, customDomainStatus: null, customDomainNote: null },
  });
  await removeVercelDomain(org.customDomain).catch(() => {});

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "website.domain_disconnected",
    summary: `Disconnected the domain ${org.customDomain}`,
  });
  revalidatePath("/dashboard/website");
  return { ok: true };
}

/**
 * Take a photograph for the website designer.
 *
 * Returns the `siteimg:` ref rather than a URL — see lib/site-blocks.ts for
 * why the block stores an id. The row is created immediately, before any
 * block points at it, so an upload the tenant then abandons is a stray row
 * rather than a lost file; sweepSiteImages() clears those on save.
 */
export async function uploadSiteImage(
  formData: FormData,
): Promise<{ ref: string; url: string } | { error: string }> {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return { error: "Only workspace admins can edit the website." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (!(SITE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Images must be PNG, JPEG, or WebP." };
  }
  if (file.size > SITE_IMAGE_MAX_BYTES) {
    return { error: `Images must be under ${Math.floor(SITE_IMAGE_MAX_BYTES / 1_000_000)} MB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await putObject(tenantId, file.name, bytes, file.type);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { slug: true },
  });
  const image = await withTenant(tenantId, (tx) =>
    tx.siteImage.create({
      data: {
        tenantId,
        filename: file.name.slice(-120),
        contentType: file.type,
        sizeBytes: file.size,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
      },
      select: { id: true },
    }),
  );

  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "website.image_uploaded",
    summary: `Uploaded a website image (${file.name.slice(-60)})`,
  });
  return { ref: siteImageRef(image.id), url: siteImageUrl(siteImageRef(image.id), org.slug) ?? "" };
}

/**
 * Drop uploads no block points at any more. Called after a layout save rather
 * than on delete, because "delete" in the designer is removing a block from
 * unsaved state — the tenant can still cancel by navigating away, and a file
 * deleted at that moment would be gone for good.
 */
async function sweepSiteImages(tenantId: string, keep: string[]): Promise<void> {
  const stale = await withTenant(tenantId, (tx) =>
    tx.siteImage.findMany({
      where: keep.length ? { id: { notIn: keep } } : {},
      select: { id: true, storageKey: true, data: true, storageProvider: true, tenantId: true },
    }),
  );
  if (stale.length === 0) return;
  // Bytes first: a failure here must not leave a row pointing at nothing, and
  // an orphaned object costs pennies where an orphaned row breaks a page.
  for (const img of stale) await deleteObject(img).catch(() => {});
  await withTenant(tenantId, (tx) =>
    tx.siteImage.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } }),
  );
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
    select: { id: true, siteConfig: true, customDomain: true },
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
  after(async () => {
    const key = await loadFubKey(org.id).catch(() => null);
    if (key) await sendFubLead(key, { name, email, phone, message }).catch(() => {});
    const conn = await loadTwentyConnection(org.id).catch(() => null);
    if (conn) await sendTwentyLead(conn, { name, email, phone }).catch(() => {});
  });

  // On the workspace's own face — subdomain or custom domain — the site lives
  // at "/"; direct apex previews at /t/<slug>. Getting this wrong on a custom
  // domain would bounce the visitor to a path that host doesn't serve.
  const host = (await headers()).get("host");
  redirect(onTenantHost(host, slug, org.customDomain) ? "/?thanks=1" : `/t/${slug}?thanks=1`);
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
