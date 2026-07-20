import { withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DangerDelete } from "@/components/danger-delete";
import { deleteTemplate, updateTemplate } from "@/lib/actions/templates";
import { MERGE_FIELD_REFERENCE } from "@/lib/templates";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnDanger, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;
  const template = await withTenant(tenantId, (tx) => tx.docTemplate.findUnique({ where: { id } }));
  if (!template) notFound();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/templates" className="text-sm text-stone-500 hover:underline">
            ← Templates
          </Link>
          <h1 className="text-xl font-semibold">{template.name}</h1>
        </div>
        {isAdmin && (
          <DangerDelete
            compact
            action={deleteTemplate}
            label="Delete template"
            description="Removes this document template."
            hidden={{ id: template.id }}
          />
        )}
      </div>

      <section className={card}>
        <form action={updateTemplate} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={template.id} />
          <div className="flex flex-wrap gap-3">
            <label className={label}>
              Name
              <input name="name" defaultValue={template.name} className={input} />
            </label>
            <label className={`${label} min-w-64 flex-1`}>
              Description
              <input
                name="description"
                defaultValue={template.description ?? ""}
                className={input}
              />
            </label>
          </div>
          <label className={label}>
            Body — plain text; lines starting with “# ” become headings
            <textarea
              name="body"
              defaultValue={template.body}
              rows={18}
              className={`${input} font-mono text-xs leading-5`}
            />
          </label>
          <div>
            <button type="submit" className={btn}>
              Save template
            </button>
          </div>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">Merge fields</h2>
        <p className="mb-2 text-sm text-stone-500">
          Unknown fields render as blanks. Party roles: BUYER, SELLER, BUYER_AGENT, LISTING_AGENT,
          LENDER, TITLE_COMPANY, INSPECTOR, APPRAISER, ATTORNEY. A second party in the same role
          (co-sellers, co-buyers) gets a numbered field instead of replacing the first —{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5">{"{{party.SELLER_2.name}}"}</code> for
          the second seller, and so on.
        </p>
        <div className="flex flex-wrap gap-2">
          {MERGE_FIELD_REFERENCE.map((fieldRef) => (
            <code key={fieldRef} className="rounded bg-stone-100 px-2 py-0.5 text-xs">
              {fieldRef}
            </code>
          ))}
        </div>
      </section>
    </div>
  );
}
