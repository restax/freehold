import { withTenant } from "@freehold/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MergeFieldBrowser, TrackedInput } from "@/components/merge-field-browser";
import { SaveMenu } from "@/components/save-menu";
import { TemplateEditor } from "@/components/template-editor";
import { TemplateTree } from "@/components/template-tree";
import {
  createEmailTemplateLib,
  deleteEmailTemplateLib,
  restoreDefaultTemplates,
  testSendEmailTemplate,
  updateEmailTemplateLib,
} from "@/lib/actions/templates";
import { EMAIL_PHASES } from "@/lib/default-email-templates";
import { MERGE_FIELD_GROUPS } from "@/lib/template-merge";
import {
  btn,
  btnGhost,
  composeLabel,
  composeRow,
  input,
  label as labelCls,
  summaryLink,
} from "@/lib/ui";

export async function TemplatesTabEmails({
  tenantId,
  isAdmin,
  restored,
  templateId,
  folderParam,
}: {
  tenantId: string;
  isAdmin: boolean;
  restored?: string;
  /** Selected template's id, or "new" to compose one that hasn't been saved yet. */
  templateId?: string;
  /** Target folder for a new template — a group id, or "none". */
  folderParam?: string;
}) {
  const [templates, groups, usageRows] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.emailTemplate.findMany({ orderBy: { name: "asc" } }),
      tx.templateGroup.findMany({ where: { kind: "EMAIL" }, orderBy: { sortOrder: "asc" } }),
      // "Used on N tasks" is computed live, not stored — it can never drift
      // from what a plan actually references.
      tx.actionPlanTask.groupBy({
        by: ["emailTemplateId"],
        _count: { _all: true },
        where: { emailTemplateId: { not: null } },
      }),
    ]),
  );
  const usageByTemplate = new Map(usageRows.map((r) => [r.emailTemplateId, r._count._all]));
  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No folder") : "No folder";

  const isNew = templateId === "new";
  const selected = !isNew ? templates.find((t) => t.id === templateId) : undefined;
  const newGroupId = folderParam && folderParam !== "none" ? folderParam : "";

  return (
    <div className="flex flex-col gap-4">
      {restored !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {Number(restored) > 0
            ? `Restored ${restored} default template${restored === "1" ? "" : "s"}.`
            : "You already have every default template."}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          One click from any task, or sent straight from a transaction. A template used inside a
          task template shows how many tasks reference it, below.
        </p>
        {isAdmin && (
          <form action={restoreDefaultTemplates}>
            <button type="submit" className={btnGhost}>
              Restore default templates
            </button>
          </form>
        )}
      </div>

      <div className="flex gap-6">
        <TemplateTree
          kind="EMAIL"
          tab="emails"
          idParam="templateId"
          label="Email templates"
          items={templates.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId }))}
          groups={groups}
          selectedId={isNew ? "new" : selected?.id}
          selectedGroupId={isNew ? (folderParam ?? null) : (selected?.groupId ?? null)}
        />

        <div className="min-w-0 flex-1">
          {!isNew && !selected && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
              <p>Select a template on the left, or create a new one.</p>
            </div>
          )}

          {isNew && (
            <div className="flex gap-6">
              <div className="min-w-0 flex-1">
                <Breadcrumbs
                  items={[
                    { label: "Templates", href: "/dashboard/templates?tab=emails" },
                    { label: "Emails", href: "/dashboard/templates?tab=emails" },
                    { label: groupName(newGroupId || null) },
                    { label: "New template" },
                  ]}
                />
                <form
                  id="tpl-create"
                  action={createEmailTemplateLib}
                  className="mt-2 flex flex-col gap-1"
                >
                  <input type="hidden" name="groupId" value={newGroupId} />
                  <input
                    name="name"
                    required
                    placeholder="Untitled template"
                    className="-mx-1 rounded px-1 py-0.5 text-lg font-semibold text-stone-900 outline-none focus:bg-stone-50"
                  />
                  <div className="mt-2 flex flex-col">
                    <div className={composeRow}>
                      <span className={composeLabel}>To</span>
                      <TrackedInput
                        name="toDefault"
                        placeholder="{{buyer_emails}}"
                        className={input}
                      />
                    </div>
                    <div className={composeRow}>
                      <span className={composeLabel}>Cc</span>
                      <TrackedInput
                        name="ccDefault"
                        placeholder="{{agent_email}}"
                        className={input}
                      />
                    </div>
                    <div className={composeRow}>
                      <span className={composeLabel}>Subject</span>
                      <TrackedInput
                        name="subject"
                        required
                        placeholder="About the appraisal — {{property_address}}"
                        className={input}
                      />
                    </div>
                    <div className={composeRow}>
                      <span className={composeLabel}>Files</span>
                      <input
                        name="filePlaceholders"
                        placeholder="Executed Contract, Financing Addendum"
                        className={input}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    <span className="text-sm font-medium text-stone-700">Body *</span>
                    <TemplateEditor name="body" rows={10} />
                  </div>

                  <details className="mt-3">
                    <summary className={summaryLink}>More settings</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className={labelCls}>
                        Category
                        <select name="category" className={input} defaultValue="GENERAL">
                          {EMAIL_PHASES.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelCls}>
                        Suggest on tasks containing
                        <input
                          name="taskMatch"
                          placeholder="appraisal, valuation"
                          className={input}
                        />
                      </label>
                      <label className={labelCls}>
                        Pre-attach documents matching
                        <input
                          name="attachMatch"
                          placeholder="pre-approval, inspection"
                          className={input}
                        />
                      </label>
                      <label className={labelCls}>
                        Note shown at compose time (never sent)
                        <input
                          name="composeNote"
                          placeholder="Check the fees before sending"
                          className={input}
                        />
                      </label>
                    </div>
                  </details>

                  <div className="mt-3 flex items-center gap-2">
                    <button type="submit" className={btn}>
                      Create template
                    </button>
                    <button type="submit" formAction={testSendEmailTemplate} className={btnGhost}>
                      Send test to me
                    </button>
                  </div>
                </form>
              </div>
              <MergeFieldBrowser groups={MERGE_FIELD_GROUPS} />
            </div>
          )}

          {selected && (
            <div className="flex gap-6">
              <div className="min-w-0 flex-1">
                {(() => {
                  const t = selected;
                  const usedOn = usageByTemplate.get(t.id) ?? 0;
                  const formId = `tpl-edit-${t.id}`;
                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Breadcrumbs
                          items={[
                            { label: "Templates", href: "/dashboard/templates?tab=emails" },
                            { label: "Emails", href: "/dashboard/templates?tab=emails" },
                            { label: groupName(t.groupId) },
                            { label: t.name.replace(" (Sample)", "") },
                          ]}
                        />
                        <span className="flex items-center gap-2 text-xs text-stone-400">
                          {usedOn > 0 && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">
                              used on {usedOn} task{usedOn === 1 ? "" : "s"}
                            </span>
                          )}
                          {t.usageCount > 0 && (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5">
                              sent {t.usageCount}×
                            </span>
                          )}
                        </span>
                      </div>

                      <form
                        id={formId}
                        action={updateEmailTemplateLib}
                        className="mt-2 flex flex-col gap-1"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          name="name"
                          defaultValue={t.name}
                          required
                          className="-mx-1 rounded px-1 py-0.5 text-lg font-semibold text-stone-900 outline-none focus:bg-stone-50"
                        />
                        <div className="mt-2 flex flex-col">
                          <div className={composeRow}>
                            <span className={composeLabel}>To</span>
                            <TrackedInput
                              name="toDefault"
                              defaultValue={t.toDefault ?? ""}
                              className={input}
                            />
                          </div>
                          <div className={composeRow}>
                            <span className={composeLabel}>Cc</span>
                            <TrackedInput
                              name="ccDefault"
                              defaultValue={t.ccDefault ?? ""}
                              className={input}
                            />
                          </div>
                          <div className={composeRow}>
                            <span className={composeLabel}>Subject</span>
                            <TrackedInput
                              name="subject"
                              defaultValue={t.subject}
                              required
                              className={input}
                            />
                          </div>
                          <div className={composeRow}>
                            <span className={composeLabel}>Files</span>
                            <input
                              name="filePlaceholders"
                              defaultValue={t.filePlaceholders ?? ""}
                              placeholder="Executed Contract, Financing Addendum"
                              className={input}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-1">
                          <span className="text-sm font-medium text-stone-700">Body</span>
                          <TemplateEditor name="body" defaultValue={t.body} rows={12} />
                        </div>

                        <details className="mt-3">
                          <summary className={summaryLink}>More settings</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className={labelCls}>
                              Category
                              <select name="category" defaultValue={t.category} className={input}>
                                {EMAIL_PHASES.map((p) => (
                                  <option key={p.key} value={p.key}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className={labelCls}>
                              Folder
                              <select
                                name="groupId"
                                defaultValue={t.groupId ?? ""}
                                className={input}
                              >
                                <option value="">No folder</option>
                                {groups.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className={labelCls}>
                              Suggest on tasks containing
                              <input
                                name="taskMatch"
                                defaultValue={t.taskMatch ?? ""}
                                className={input}
                              />
                            </label>
                            <label className={labelCls}>
                              Pre-attach documents matching
                              <input
                                name="attachMatch"
                                defaultValue={t.attachMatch ?? ""}
                                className={input}
                              />
                            </label>
                            <label className={`${labelCls} sm:col-span-2`}>
                              Note shown at compose time
                              <input
                                name="composeNote"
                                defaultValue={t.composeNote ?? ""}
                                className={input}
                              />
                            </label>
                          </div>
                        </details>
                      </form>

                      <div className="mt-3 flex items-center gap-2">
                        <SaveMenu
                          formId={formId}
                          deleteAction={deleteEmailTemplateLib}
                          deleteLabel="Delete this template"
                          deleteDescription={`Removes "${t.name}".${usedOn > 0 ? ` Still referenced by ${usedOn} task template${usedOn === 1 ? "" : "s"} — those entries will stop attaching an email.` : ""} This cannot be undone.`}
                          hidden={{ id: t.id }}
                        />
                        <button
                          type="submit"
                          form={formId}
                          formAction={testSendEmailTemplate}
                          className={btnGhost}
                        >
                          Send test to me
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
              <MergeFieldBrowser groups={MERGE_FIELD_GROUPS} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
