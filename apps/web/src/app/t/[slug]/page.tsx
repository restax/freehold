import { prisma, withTenant } from "@freehold/db";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TenantSiteView } from "@/components/tenant-site";
import { submitTenantLead } from "@/lib/actions/website";
import { parseSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true, siteConfig: true },
  });
  const site = parseSiteConfig(org?.siteConfig);
  return site.published
    ? {
        title: org ? `${org.name}${site.tagline ? ` — ${site.tagline}` : ""}` : "Client portal",
        description: site.about?.slice(0, 160),
      }
    : {
        title: org ? `${org.name} — Client portal` : "Client portal",
        robots: { index: false },
      };
}

/**
 * A tenant's public face at <slug>.<root>. Unpublished (the default): a
 * minimal portal entry page. Published: the white-theme promotional
 * mini-site (TenantSiteView) with an optional new-client registration form
 * that lands in the workspace as a lead. Real transaction data is only ever
 * behind private /portal/<token> links.
 */
export default async function TenantSite({ params, searchParams }: Props) {
  const { slug } = await params;
  const { thanks } = await searchParams;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, logo: true, siteConfig: true },
  });
  if (!org) notFound();
  const site = parseSiteConfig(org.siteConfig);
  // Forms place themselves: anything published and marked for the public
  // website shows up here without the TC linking it.
  const publicForms = await withTenant(org.id, (tx) =>
    tx.form.findMany({
      where: { status: "published", showPublic: true, clientId: null },
      orderBy: { name: "asc" },
      select: { slug: true, title: true, description: true },
    }),
  );

  if (!site.published) {
    return (
      <main className="flex min-h-screen flex-col bg-[radial-gradient(90%_120%_at_50%_0%,#0b7a49_0%,#054f30_100%)] text-white">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-200">
            Client portal
          </p>
          <h1 className="font-display mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            {org.name}
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-brand-50/90">
            This is the secure portal where clients of {org.name} follow their transactions. Access
            is by the private link your coordinator sends — ask them to re-send it at any time.
          </p>
        </div>
        <footer className="pb-8 text-center text-xs text-brand-50/60">
          Powered by{" "}
          <a
            href="https://freeholdtc.dev"
            className="font-medium text-brand-50/90 hover:text-white"
          >
            Freehold
          </a>
        </footer>
      </main>
    );
  }

  // On the workspace's own host, middleware rewrote acme.<root>/ to here and
  // the browser's URL is still the subdomain, so /f/<form> resolves. Reached
  // at the apex as /t/<slug>, it doesn't — the links need the prefix.
  const host = (await headers()).get("host") ?? "";
  const onOwnHost = host.startsWith(`${slug}.`);

  return (
    <TenantSiteView
      name={org.name}
      logoUrl={org.logo}
      site={site}
      publicForms={publicForms}
      formBase={onOwnHost ? "/f" : `/t/${slug}/f`}
      thanks={Boolean(thanks)}
      leadAction={submitTenantLead}
      hiddenFields={{ slug }}
    />
  );
}
