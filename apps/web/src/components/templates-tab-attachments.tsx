import { withTenant } from "@freehold/db";
import { Bell, Flag } from "@phosphor-icons/react/dist/ssr";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { TemplateTree } from "@/components/template-tree";
import {
  addAttachmentTemplateItem,
  createAttachmentTemplate,
  deleteAttachmentTemplate,
  deleteAttachmentTemplateItem,
  toggleAttachmentItemRemind,
  toggleAttachmentItemRequired,
  updateAttachmentTemplate,
} from "@/lib/actions/attachment-templates";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

const iconToggleBtn = (active: boolean) =>
  `flex h-6 w-6 items-center justify-center rounded transition-colors ${
    active ? "text-brand-700 hover:text-brand-800" : "text-stone-300 hover:text-stone-500"
  }`;

export async function TemplatesTabAttachments({
  tenantId,
  isAdmin,
  attachmentId,
  folderParam,
}: {
  tenantId: string;
  isAdmin: boolean;
  attachmentId?: string;
  folderParam?: string;
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

  const isNew = attachmentId === "new";
  const template = !isNew ? templates.find((t) => t.id === attachmentId) : undefined;
  const newGroupId = folderParam && folderParam !== "none" ? folderParam : "";
  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No folder") : "No folder";

  return (
    <div className="flex gap-6">
      <TemplateTree
        kind="ATTACHMENT"
        tab="attachments"
        idParam="attachmentId"
        label="Attachment templates"
        newLabel="New attachment template"
        items={templates.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId }))}
        groups={groups}
        selectedId={isNew ? "new" : template?.id}
        selectedGroupId={isNew ? (folderParam ?? null) : (template?.groupId ?? null)}
      />

      <div className="min-w-0 flex-1">
        {!isNew && !template && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
            <p>Select an attachment template on the left, or create a new one.</p>
          </div>
        )}

        {isNew && (
          <div className="flex flex-col gap-4">
            <Breadcrumbs
              items={[
                { label: "Templates", href: "/dashboard/templates?tab=attachments" },
                { label: "Attachments", href: "/dashboard/templates?tab=attachments" },
                { label: groupName(newGroupId || null) },
                { label: "New attachment template" },
              ]}
            />
            <p className="text-sm text-stone-500">
              Named document checklists a task template entry can attach — applying one seeds the
              transaction's required-documents list.
            </p>
            <section className={card}>
              <form action={createAttachmentTemplate} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="groupId" value={newGroupId} />
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
            </section>
          </div>
        )}

        {template && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Breadcrumbs
                items={[
                  { label: "Templates", href: "/dashboard/templates?tab=attachments" },
                  { label: "Attachments", href: "/dashboard/templates?tab=attachments" },
                  { label: groupName(template.groupId) },
                  { label: template.name },
                ]}
              />
              {isAdmin && (
                <DangerDelete
                  compact
                  action={deleteAttachmentTemplate}
                  label="Delete"
                  description={`Removes "${template.name}" and its ${template.items.length} document label${template.items.length === 1 ? "" : "s"}.`}
                  hidden={{ id: template.id }}
                />
              )}
            </div>

            <section className={card}>
              <form
                action={updateAttachmentTemplate}
                className="mb-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="id" value={template.id} />
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
                <button type="submit" className={btnGhost}>
                  Save
                </button>
              </form>

              {template.items.length > 0 && (
                <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                  {template.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span className={item.required ? "" : "text-stone-400"}>
                        {item.label}
                        {item.folderName && (
                          <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                            {item.folderName}
                          </span>
                        )}
                        {!item.required && <span className="ml-1.5 text-xs">(optional)</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <form action={toggleAttachmentItemRequired}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            title={
                              item.required
                                ? "Mandatory — click to make optional"
                                : "Optional — click to make mandatory"
                            }
                            className={iconToggleBtn(item.required)}
                          >
                            <Flag size={14} weight={item.required ? "fill" : "regular"} />
                          </button>
                        </form>
                        <form action={toggleAttachmentItemRemind}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            title={
                              item.remindEnabled
                                ? "Auto-reminders on — click to turn off"
                                : "Auto-reminders off — click to turn on until this is received"
                            }
                            className={iconToggleBtn(item.remindEnabled)}
                          >
                            <Bell size={14} weight={item.remindEnabled ? "fill" : "regular"} />
                          </button>
                        </form>
                        <form action={deleteAttachmentTemplateItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addAttachmentTemplateItem} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="attachmentTemplateId" value={template.id} />
                <label className={`${label} min-w-40 flex-1`}>
                  Add a document
                  <input name="label" required placeholder="Executed contract" className={input} />
                </label>
                {/* Optional, and matched by name: applying the template
                    creates the folder on the transaction if it isn't there,
                    so one template can lay out a whole filing structure. */}
                <label className={label}>
                  Folder
                  <input name="folderName" placeholder="Contract" className={input} />
                </label>
                <button type="submit" className={btnGhost}>
                  Add
                </button>
              </form>
              <p className="mt-3 flex items-center gap-3 text-xs text-stone-400">
                <span className="flex items-center gap-1">
                  <Flag size={12} weight="fill" /> mandatory
                </span>
                <span className="flex items-center gap-1">
                  <Bell size={12} weight="fill" /> auto-reminders on
                </span>
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
