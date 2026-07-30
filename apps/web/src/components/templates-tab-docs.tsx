import { withTenant } from "@freehold/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { SectionCard } from "@/components/section-card";
import { TemplateTree } from "@/components/template-tree";
import { createTemplate, deleteTemplate, updateTemplate } from "@/lib/actions/templates";
import { MERGE_FIELD_REFERENCE } from "@/lib/templates";
import { btn, card, input, label } from "@/lib/ui";

export async function TemplatesTabDocs({
  tenantId,
  isAdmin,
  docId,
  folderParam,
}: {
  tenantId: string;
  isAdmin: boolean;
  docId?: string;
  folderParam?: string;
}) {
  const [templates, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
      tx.templateGroup.findMany({ where: { kind: "DOC" }, orderBy: { sortOrder: "asc" } }),
    ]),
  );

  const isNew = docId === "new";
  const template = !isNew ? templates.find((t) => t.id === docId) : undefined;
  const newGroupId = folderParam && folderParam !== "none" ? folderParam : "";
  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No folder") : "No folder";

  return (
    <div className="flex gap-6">
      <TemplateTree
        kind="DOC"
        tab="docs"
        idParam="docId"
        label="Doc templates"
        newLabel="New doc template"
        items={templates.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId }))}
        groups={groups}
        selectedId={isNew ? "new" : template?.id}
        selectedGroupId={isNew ? (folderParam ?? null) : (template?.groupId ?? null)}
      />

      <div className="min-w-0 flex-1">
        {!isNew && !template && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
            <p>Select a doc template on the left, or create a new one.</p>
          </div>
        )}

        {isNew && (
          <div className="flex flex-col gap-4">
            <Breadcrumbs
              items={[
                { label: "Templates", href: "/dashboard/templates?tab=docs" },
                { label: "Docs", href: "/dashboard/templates?tab=docs" },
                { label: groupName(newGroupId || null) },
                { label: "New doc template" },
              ]}
            />
            <p className="text-sm text-stone-500">
              Reusable letters and forms with merge fields like{" "}
              <code>{"{{transaction.propertyAddress}}"}</code> — generate a filled PDF on any
              transaction.
            </p>
            <section className={card}>
              <form action={createTemplate} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="groupId" value={newGroupId} />
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
            </section>
          </div>
        )}

        {template && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Breadcrumbs
                items={[
                  { label: "Templates", href: "/dashboard/templates?tab=docs" },
                  { label: "Docs", href: "/dashboard/templates?tab=docs" },
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
                      <option value="">No folder</option>
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
          </div>
        )}
      </div>
    </div>
  );
}
