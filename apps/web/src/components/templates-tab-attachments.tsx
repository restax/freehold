import { withTenant } from "@freehold/db";
import { DangerDelete } from "@/components/danger-delete";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import {
  addAttachmentTemplateItem,
  createAttachmentTemplate,
  deleteAttachmentTemplate,
  deleteAttachmentTemplateItem,
} from "@/lib/actions/attachment-templates";
import { btn, btnGhost, card, input, label, summaryLink } from "@/lib/ui";

export async function TemplatesTabAttachments({
  tenantId,
  groupParam,
}: {
  tenantId: string;
  groupParam?: string;
}) {
  const [templates, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.attachmentTemplate.findMany({
        orderBy: { name: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      }),
      tx.templateGroup.findMany({ where: { kind: "ATTACHMENT" }, orderBy: { sortOrder: "asc" } }),
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
        kind="ATTACHMENT"
        tab="attachments"
        groups={railGroups}
        noGroupCount={noGroupCount}
        totalCount={templates.length}
        activeGroupId={groupParam}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-sm text-stone-500">
          Named document checklists a task template entry can attach — applying one seeds the
          transaction's required-documents list.
        </p>

        <details className={card}>
          <summary className={summaryLink}>+ New attachment template</summary>
          <form action={createAttachmentTemplate} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="groupId" value={groupParam !== "none" ? groupParam : ""} />
            <label className={label}>
              Name *
              <input name="name" required className={input} placeholder="Under contract file" />
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

        {visible.length === 0 ? (
          <section className={card}>
            <p className="py-6 text-center text-sm text-stone-400">
              No attachment templates {groupParam && groupParam !== "all" ? "in this group" : "yet"}
              .
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((t) => (
              <section key={t.id} className={card}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    {t.description && <p className="text-sm text-stone-500">{t.description}</p>}
                  </div>
                  <DangerDelete
                    compact
                    action={deleteAttachmentTemplate}
                    label="Delete"
                    description={`Removes "${t.name}" and its ${t.items.length} document label${t.items.length === 1 ? "" : "s"}.`}
                    hidden={{ id: t.id }}
                  />
                </div>
                {t.items.length > 0 && (
                  <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                    {t.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        {item.label}
                        <form action={deleteAttachmentTemplateItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={addAttachmentTemplateItem} className="flex items-end gap-2">
                  <input type="hidden" name="attachmentTemplateId" value={t.id} />
                  <label className={`${label} flex-1`}>
                    Add a document
                    <input
                      name="label"
                      required
                      placeholder="Executed contract"
                      className={input}
                    />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Add
                  </button>
                </form>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
