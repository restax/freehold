import { prisma } from "@freehold/db";
import { ArrowUUpLeft, Buildings } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScreenshotPaste } from "@/components/screenshot-paste";
import { SectionCard } from "@/components/section-card";
import { extractLead, saveLeadToCrm } from "@/lib/actions/crm-capture";
import { isOperator } from "@/lib/operator";
import { twentyStatus } from "@/lib/twenty";
import { btn, btnGhost, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CRM_SOURCE_ORG_SLUG = "acme-brokers-inc";

const ERROR_MESSAGE: Record<string, string> = {
  nofile: "Paste or choose a screenshot first.",
  toobig: "That image is over 10 MB. Crop it or save it smaller.",
  type: "That file type isn't supported. Use PNG, JPEG, GIF, or WebP.",
  extract: "Reading the screenshot failed. Try again in a moment.",
  empty: "No contact details were found in that image.",
  noname: "Enter at least a name or a company before saving.",
  noconn: "Twenty CRM isn't connected, so there's nowhere to save this.",
  save: "Saving to Twenty failed. Try again in a moment.",
};

/**
 * Paste a screenshot of a contact (a business page, profile, signature block,
 * or card), read the details out of it, review them, and push the result to
 * Twenty CRM as a person plus a linked company.
 *
 * Two steps on purpose: the model's reading is always shown in an editable
 * form before anything is written, because a misread phone number is much
 * cheaper to fix here than in the CRM.
 */
export default async function CrmCapturePage({
  searchParams,
}: {
  searchParams: Promise<{
    found?: string;
    saved?: string;
    error?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    company?: string;
  }>;
}) {
  if (!(await isOperator())) notFound();
  const sp = await searchParams;

  const org = await prisma.organization.findFirst({
    where: { slug: CRM_SOURCE_ORG_SLUG },
    select: { id: true },
  });
  const crm = org ? await twentyStatus(org.id) : { connected: false as const };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          &larr; Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Screenshot to CRM</h1>
        <p className="text-sm text-stone-500">
          Paste a screenshot of a contact and the details go to Twenty CRM as a person, with their
          company linked.
        </p>
      </div>

      {!crm.connected && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Twenty CRM isn't connected on <code>{CRM_SOURCE_ORG_SLUG}</code>'s workspace, so nothing
          can be saved yet. Connect it from that workspace's Integrations page first.
        </p>
      )}

      {sp.saved === "1" && (
        <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Saved to Twenty.
        </p>
      )}
      {sp.saved === "partial" && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The person was saved, but their company couldn't be linked. Add it by hand in Twenty.
        </p>
      )}
      {sp.error && ERROR_MESSAGE[sp.error] && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ERROR_MESSAGE[sp.error]}
        </p>
      )}

      {sp.found === "1" ? (
        <SectionCard
          title="Check the details"
          icon={<Buildings size={15} weight="fill" aria-hidden />}
          bodyClassName="p-4"
        >
          <p className="mb-3 text-sm text-stone-500">
            Read from the screenshot. Fix anything that came out wrong, then save.
          </p>
          <form action={saveLeadToCrm} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={label}>
              First name
              <input name="firstName" defaultValue={sp.firstName ?? ""} className={input} />
            </label>
            <label className={label}>
              Last name
              <input name="lastName" defaultValue={sp.lastName ?? ""} className={input} />
            </label>
            <label className={label}>
              Phone
              <input name="phone" type="tel" defaultValue={sp.phone ?? ""} className={input} />
            </label>
            <label className={label}>
              Email
              <input name="email" type="email" defaultValue={sp.email ?? ""} className={input} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Company
              <input name="company" defaultValue={sp.company ?? ""} className={input} />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" className={btn} disabled={!crm.connected}>
                Save to Twenty
              </button>
              <Link href="/admin/crm-capture" className={btnGhost}>
                <ArrowUUpLeft size={14} className="mr-1 inline" aria-hidden />
                Start over
              </Link>
            </div>
          </form>
        </SectionCard>
      ) : (
        <SectionCard title="Paste a screenshot" bodyClassName="p-4">
          <form action={extractLead}>
            <ScreenshotPaste />
          </form>
        </SectionCard>
      )}
    </main>
  );
}
