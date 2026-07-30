import { withTenant } from "@freehold/db";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import { createTemplate } from "@/lib/actions/templates";
import { btn, card, input, label, summaryLink, tableWrap, td, th, trHover } from "@/lib/ui";

export async function TemplatesTabDocs({
  tenantId,
  groupParam,
}: {
  tenantId: string;
  groupParam?: string;
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
        <p className="text-sm text-stone-500">
          Reusable letters and forms with merge fields like{" "}
          <code>{"{{transaction.propertyAddress}}"}</code> — generate a filled PDF on any
          transaction.
        </p>

        <details className={card}>
          <summary className={summaryLink}>+ New doc template</summary>
          <form action={createTemplate} className="mt-4 flex flex-wrap items-end gap-3">
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
                          href={`/dashboard/templates/${t.id}`}
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
      </div>
    </div>
  );
}
