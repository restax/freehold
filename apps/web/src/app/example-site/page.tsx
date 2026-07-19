import Link from "next/link";
import { TenantSiteView } from "@/components/tenant-site";
import { submitExampleLead } from "@/lib/actions/website";
import type { TenantSiteConfig } from "@/lib/site-config";

export const metadata = {
  title: "Example tenant website | Freehold",
  description:
    "A live example of the promotional website every Freehold workspace gets on its own subdomain — with new-client registration that lands as a lead.",
};

/**
 * The always-on example of a tenant website, backed by nothing: a fictional
 * brokerage, hardcoded config, and a form that stores no data. Linked from
 * the marketing pages so prospects can see the feature without a login.
 */
const EXAMPLE: TenantSiteConfig = {
  published: true,
  showRegistration: true,
  tagline: "Contract to close, handled.",
  about:
    "Harborline coordinates real-estate transactions end to end — contracts, deadlines, documents, and closings — so agents stay in the field and clients always know what's next.",
  phone: "(555) 014-2288",
  email: "hello@harborline.example",
  services:
    "Contract-to-close coordination\nListing management\nCompliance & document management\nClient & agent portals",
};

export default async function ExampleSitePage({
  searchParams,
}: {
  searchParams: Promise<{ thanks?: string }>;
}) {
  const { thanks } = await searchParams;
  return (
    <>
      <div className="border-b border-stone-200 bg-stone-900 px-4 py-3.5 text-center text-sm text-stone-200">
        This is a live example of the website every Freehold workspace gets on its own subdomain.
        The form below stores nothing.{" "}
        <Link href="/features" className="font-medium text-white underline underline-offset-2">
          See all features
        </Link>
      </div>
      <TenantSiteView
        name="Harborline Transaction Co."
        site={EXAMPLE}
        thanks={Boolean(thanks)}
        leadAction={submitExampleLead}
        hiddenFields={{}}
        heroImageSrc="/site/site-team.jpg"
        about={{
          heading: "About us",
          body: "Harborline is Dana Whitfield and Priya Rao. They met ten years ago running the closing desk at a harbor-town brokerage, and they have kept files moving ever since: more than forty transactions a year, every one handled by the same two people who answer the phone. Small on purpose — you always know who has your file.",
        }}
      />
    </>
  );
}
