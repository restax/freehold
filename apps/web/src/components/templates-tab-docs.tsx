import { withTenant } from "@freehold/db";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import { createTemplate, deleteTemplate, updateTemplate } from "@/lib/actions/templates";
import { MERGE_FIELD_REFERENCE } from "@/lib/templates";
import { btn, card, input, label, summaryLink, tableWrap, td, th, trHover } from "@/lib/ui";

export async function TemplatesTabDocs({
  tenantId,
  isAdmin,
  groupParam,
  docId,
}: {
  tenantId: string;
  isAdmin: boolean;
  groupParam?: string;
  docId?: string;
}) {
  const [templates, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
      tx.templateGroup.findMany({ where: { kind: "DOC" }, orderBy: { sortOrder: "asc" } }),
    ]),
  );

  const railGroups: RailGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    count: templates.filter((t) => t.groupId === g.id).length,
  }));
  const noGroupCount = templates.filter((t) => !t.groupId).length;
  const visible =
    !groupParam || groupParam === "all"
      ? templates
      : groupParam === "none"
        ? templates.filter((t) => !t.groupId)
        : templates.filter((t) => t.groupId === groupParam);

  const template = docId ? templates.find((t) => t.id === docId) : undefined;
  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No group") : "No group";
  const listHref = (id?: string) => `/dashboard/templates?tab=docs${id ? `&group=${id}` : ""}`;
  const docHref = (id: string) =>
    `/dashboard/templates?tab=docs${groupParam ? `&group=${groupParam}` : ""}&docId=${id}`;

  return (
    <div className="flex gap-6">
      <TemplateGroupRail
        kind="DOC"
        tab="docs"
        groups={railGroups}
        noGroupCount={noGroupCount}
        totalCount={templates.length}
        activeGroupId={groupParam}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {!docId && (
          <>
            <p className="text-sm text-stone-500">
              Reusable letters and forms with merge fields like{" "}
              <code>{"{{transaction.propertyAddress}}"}</code> — generate a filled PDF on any
              transaction.
            </p>

            <details className={card}>
              <summary className={summaryLink}>+ New doc template</summary>
              <form action={createTemplate} className="mt-4 flex flex-wrap items-end gap-3">
                <input
                  type="hidden"
                  name="groupId"
                  value={groupParam !== "none" ? groupParam : ""}
                />
                <label className={label}>
                  Name *
                  <input name="name" required className={input} placeholder="Listing Summary" />
                </label>
                <label className={`${label} min-w-64 flex-1`}>
                  Description
                  <input name="description" className={input} />
                </label>
                <button type="submit" className={btn}>
                  Create
                </button>
              </form>
            </details>

            <section className={card}>
              {visible.length === 0 ? (
                <EmptyState
                  title="No doc templates yet"
                  hint="Build a letter or summary once with merge fields, then generate a filled PDF on any transaction in one click."
                />
              ) : (
                <div className={tableWrap}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={th}>Name</th>
                        <th className={th}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((t) => (
                        <tr key={t.id} className={trHover}>
                          <td className={td}>
                            <Link
                              href={docHref(t.id)}
                              className="font-medium text-brand-700 hover:text-brand-600"
                            >
                              {t.name}
                            </Link>
                          </td>
                          <td className={td}>{t.description ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {docId && !template && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
            <p>That doc template wasn't found — it may have been deleted.</p>
            <Link href={listHref()} className="text-brand-700 hover:underline">
              Back to doc templates
            </Link>
          </div>
        )}

        {template && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Breadcrumbs
                items={[
                  { label: "Templates", href: listHref() },
                  { label: "Docs", href: listHref() },
                  { label: groupName(template.groupId) },
                  { label: template.name },
                ]}
              />
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
                  <label className={label}>
                    Folder
                    <select name="groupId" defaultValue={template.groupId ?? ""} className={input}>
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
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

            <SectionCard title="Merge fields">
              <p className="mb-2 text-sm text-stone-500">
                Unknown fields render as blanks. Party roles: BUYER, SELLER, BUYER_AGENT,
                LISTING_AGENT, LENDER, TITLE_COMPANY, INSPECTOR, APPRAISER, ATTORNEY. A second party
                in the same role (co-sellers, co-buyers) gets a numbered field instead of replacing
                the first —{" "}
                <code className="rounded bg-stone-100 px-1 py-0.5">
                  {"{{party.SELLER_2.name}}"}
                </code>{" "}
                for the second seller, and so on.
              </p>
              <div className="flex flex-wrap gap-2">
                {MERGE_FIELD_REFERENCE.map((fieldRef) => (
                  <code key={fieldRef} className="rounded bg-stone-100 px-2 py-0.5 text-xs">
                    {fieldRef}
                  </code>
                ))}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
