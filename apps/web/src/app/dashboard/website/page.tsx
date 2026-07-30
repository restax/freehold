import { prisma } from "@freehold/db";
import Link from "next/link";
import QRCode from "qrcode";
import { SectionCard } from "@/components/section-card";
import { saveSiteConfig } from "@/lib/actions/website";
import { parseSiteConfig, tenantSiteUrl } from "@/lib/site-config";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, input, label as labelCls } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: tenantId },
    select: { name: true, slug: true, logo: true, siteConfig: true },
  });
  const site = parseSiteConfig(org.siteConfig);
  const url = tenantSiteUrl(org.slug);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });
  const qrPng = await QRCode.toDataURL(url, { margin: 1, width: 900 });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Your website</h1>
        <p className="text-sm text-stone-500">
          Every workspace gets its own site at{" "}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            {url.replace(/^https?:\/\//, "")}
          </a>{" "}
          — a public page for your business where new clients can register, feeding straight into
          your contacts as leads. Your clients' transaction data stays behind private portal links
          either way.
        </p>
      </div>

      <SectionCard title="Page content">
        <p className="mb-4 text-sm text-stone-500">
          Until you publish, the address shows a plain client-portal entry page.
        </p>
        <form action={saveSiteConfig} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Tagline
              <input
                name="tagline"
                defaultValue={site.tagline ?? ""}
                placeholder="Transaction coordination that closes on time"
                className={input}
              />
            </label>
            <label className={labelCls}>
              Public email
              <input
                name="email"
                type="email"
                defaultValue={site.email ?? ""}
                placeholder="hello@yourbusiness.com"
                className={input}
              />
            </label>
            <label className={labelCls}>
              Public phone
              <input name="phone" defaultValue={site.phone ?? ""} className={input} />
            </label>
          </div>
          <label className={labelCls}>
            About your business
            <textarea
              name="about"
              rows={3}
              defaultValue={site.about ?? ""}
              placeholder={`${org.name} keeps real-estate transactions on track — contracts, deadlines, and closings handled end to end.`}
              className={input}
            />
          </label>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Logo (PNG/JPEG/WebP, up to 1 MB)
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
              />
            </label>
            {org.logo && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={org.logo}
                  alt="Current logo"
                  className="h-10 w-auto max-w-36 rounded border border-stone-200 bg-white object-contain p-1"
                />
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input type="checkbox" name="removeLogo" />
                  Remove logo
                </label>
              </div>
            )}
          </div>
          <label className={labelCls}>
            Services (one per line)
            <textarea
              name="services"
              rows={4}
              defaultValue={site.services ?? ""}
              placeholder={
                "Contract-to-close coordination\nListing management\nCompliance & document management"
              }
              className={input}
            />
          </label>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input type="checkbox" name="published" defaultChecked={site.published ?? false} />
              Publish the site
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                name="showRegistration"
                defaultChecked={site.showRegistration ?? true}
              />
              Allow new-client registration
            </label>
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <button type="submit" className={btn}>
                Save
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View site →
              </a>
            </div>
          ) : (
            <p className="text-sm text-stone-400">Only workspace admins can edit the website.</p>
          )}
        </form>
      </SectionCard>

      <SectionCard title="QR code">
        <p className="mb-4 text-sm text-stone-500">
          Points at your site — put it on business cards, yard signs, open-house flyers, or listing
          one-pagers. New clients scan, register, and land in your contacts as a lead with a
          follow-up task.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <div
            className="h-[200px] w-[200px] overflow-hidden rounded-xl border border-stone-200 bg-white p-2"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is generated server-side by the qrcode library from our own URL — no user content.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="flex flex-col gap-2 text-sm">
            <a
              href={qrPng}
              download={`${org.slug}-website-qr.png`}
              className="font-medium text-brand-700 hover:underline"
            >
              Download PNG (print quality) →
            </a>
            <a
              href={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
              download={`${org.slug}-website-qr.svg`}
              className="font-medium text-brand-700 hover:underline"
            >
              Download SVG (any size) →
            </a>
            <p className="text-xs text-stone-400">
              The code encodes {url.replace(/^https?:\/\//, "")} — it keeps working even as you
              update the page.
            </p>
          </div>
        </div>
      </SectionCard>

      <p className="text-xs text-stone-400">
        Leads arrive under Contacts with the "Website Lead" category and a same-day follow-up task
        on{" "}
        <Link href="/dashboard" className="underline hover:text-brand-700">
          Today
        </Link>
        .
      </p>
    </div>
  );
}
