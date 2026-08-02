import { prisma, withTenant } from "@freehold/db";
import type { Metadata } from "next";
import { TenantSiteView } from "@/components/tenant-site";
import { parseLayout } from "@/lib/form-schema";
import { parseSiteConfig } from "@/lib/site-config";
import { requireAdminTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Never let a preview of an unpublished site turn up in search.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The tenant's own site, rendered exactly as the public page renders it, for
 * the preview pane on /dashboard/website.
 *
 * Deliberately a sibling of /dashboard rather than a child: it is loaded in an
 * iframe, and a child route would drag the dashboard chrome (sidebar, header)
 * in with it. Auth-gated with the same requireAdminTenant as the page that
 * embeds it, so an unpublished site is never visible to anyone outside the
 * workspace.
 *
 * It renders TenantSiteView rather than a lookalike so the preview cannot
 * drift from the real thing — one component, two callers (this and
 * /t/[slug]). The published flag is ignored here on purpose: the whole point
 * is seeing what you are about to publish.
 */
export default async function SitePreview() {
  const { tenantId } = await requireAdminTenant();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, slug: true, logo: true, siteConfig: true },
  });
  const site = parseSiteConfig(org.siteConfig);
  const publicForms = await withTenant(tenantId, (tx) =>
    tx.form.findMany({
      where: { status: "published", showPublic: true, clientId: null },
      orderBy: { name: "asc" },
      select: { slug: true, title: true, description: true },
    }),
  );
  // Same New client form the live site renders, so the preview shows the
  // questions visitors will actually be asked.
  const intake = await withTenant(tenantId, (tx) =>
    tx.form.findFirst({
      where: { kind: "client_intake", status: "published", showPublic: true, clientId: null },
      orderBy: { createdAt: "asc" },
      select: { title: true, description: true, layout: true },
    }),
  );

  // The preview is a picture, not a working page: submitting the lead form
  // here would file the TC as their own lead. The pane also sets
  // pointer-events:none, so this is the belt to that's braces.
  async function inert() {
    "use server";
  }

  return (
    <TenantSiteView
      name={org.name}
      slug={org.slug}
      logoUrl={org.logo}
      site={site}
      publicForms={publicForms}
      formBase={`/t/${org.slug}/f`}
      thanks={false}
      leadAction={inert}
      hiddenFields={{}}
      intakeForm={
        intake
          ? {
              title: intake.title,
              description: intake.description,
              layout: parseLayout(intake.layout),
            }
          : null
      }
    />
  );
}
