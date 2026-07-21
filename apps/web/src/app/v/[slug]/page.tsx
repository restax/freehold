import { prisma } from "@freehold/db";
import { Envelope, Phone, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { categoryLabel, coverageLabel } from "@/lib/vendor-profile";

export const dynamic = "force-dynamic";

/**
 * A vendor's public storefront: freeholdtc.dev/v/<slug>. This is where a
 * Sponsored ad and a directory listing point. It shows only the public tier of
 * the profile — bio, public phone/email, coverage areas, and the credentials
 * the vendor keeps on file (labels only, never the files). The slug is resolved
 * to a vendor here; it is never trusted as an authorization token, and nothing
 * client-facing or private is ever rendered.
 *
 * The page renders for any vendor that has a slug, so a vendor can share their
 * link the moment they see it in their profile — but it's kept out of search
 * indexes unless they've opted into the directory (`listed`).
 */

async function loadVendor(slug: string) {
  return prisma.vendor.findUnique({
    where: { slug },
    select: {
      name: true,
      category: true,
      listed: true,
      publicBio: true,
      blurb: true,
      publicPhone: true,
      phone: true,
      publicEmail: true,
      serviceArea: true,
      coverage: {
        orderBy: [{ kind: "asc" }, { value: "asc" }],
        select: { kind: true, value: true },
      },
      documents: {
        where: { shareOnOrder: true },
        orderBy: { createdAt: "asc" },
        select: { label: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await loadVendor(slug);
  if (!vendor) return { title: "Vendor not found | Freehold" };
  const bio = vendor.publicBio ?? vendor.blurb ?? undefined;
  return {
    title: `${vendor.name} | Freehold`,
    description: bio ?? `${categoryLabel(vendor.category)} on Freehold.`,
    // Only vendors who opted into the directory are indexable; a direct link
    // still works for everyone else.
    robots: vendor.listed ? undefined : { index: false, follow: false },
  };
}

export default async function PublicVendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await loadVendor(slug);
  if (!vendor) notFound();

  const bio = vendor.publicBio ?? vendor.blurb;
  const phone = vendor.publicPhone ?? vendor.phone;
  const email = vendor.publicEmail;

  const states = vendor.coverage.filter((c) => c.kind === "STATE");
  const counties = vendor.coverage.filter((c) => c.kind === "COUNTY");
  const zips = vendor.coverage.filter((c) => c.kind === "ZIP");
  const coverageGroups: Array<[string, typeof vendor.coverage]> = [
    ["States", states],
    ["Counties", counties],
    ["ZIP codes", zips],
  ];
  const hasCoverage = vendor.coverage.length > 0;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="relative overflow-hidden border-b border-stone-200">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(80%_120%_at_15%_-10%,rgba(13,146,87,0.10),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <span className="inline-block rounded-full bg-brand-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            {categoryLabel(vendor.category)}
          </span>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            {vendor.name}
          </h1>
          {vendor.serviceArea && <p className="mt-2 text-stone-500">{vendor.serviceArea}</p>}
          {bio && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">{bio}</p>}

          {(phone || email) && (
            <div className="mt-7 flex flex-wrap gap-3">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  <Phone size={18} weight="fill" aria-hidden />
                  {phone}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition hover:border-brand-400 hover:text-brand-700"
                >
                  <Envelope size={18} weight="fill" aria-hidden />
                  {email}
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl gap-8 px-4 py-12 sm:px-6">
        {hasCoverage && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Where {vendor.name} works
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {coverageGroups.map(([label, items]) =>
                items.length === 0 ? null : (
                  <div key={label} className="flex flex-wrap items-baseline gap-2">
                    <span className="w-20 shrink-0 text-xs font-medium uppercase text-stone-400">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {items.map((c) => (
                        <span
                          key={`${c.kind}-${c.value}`}
                          className="rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-700"
                        >
                          {coverageLabel(c.kind, c.value)}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {vendor.documents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Credentials on file
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Shared automatically with the coordinator when you place an order.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {vendor.documents.map((d) => (
                <li
                  key={d.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-700"
                >
                  <SealCheck size={16} weight="fill" className="text-brand-600" aria-hidden />
                  {d.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Soft CTA for coordinators who landed here from an ad or directory. */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="font-semibold">Are you a transaction coordinator?</h2>
          <p className="mt-1 text-sm text-stone-600">
            Connect with {vendor.name} on Freehold to send orders, schedule, and get documents back
            on the file — no email back-and-forth.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/vendors"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Connect on Freehold
            </Link>
            <Link
              href="/vendors"
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-400"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
