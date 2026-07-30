import { withTenant } from "@freehold/db";
import { DangerDelete } from "@/components/danger-delete";
import { TemplateEditor } from "@/components/template-editor";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import {
  createEmailTemplateLib,
  deleteEmailTemplateLib,
  restoreDefaultTemplates,
  updateEmailTemplateLib,
} from "@/lib/actions/templates";
import { EMAIL_PHASES } from "@/lib/default-email-templates";
import { btn, btnGhost, card, input, label as labelCls, summaryLink } from "@/lib/ui";

export async function TemplatesTabEmails({
  tenantId,
  groupParam,
  isAdmin,
  restored,
}: {
  tenantId: string;
  groupParam?: string;
  isAdmin: boolean;
  restored?: string;
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
        kind="EMAIL"
        tab="emails"
        groups={railGroups}
        noGroupCount={noGroupCount}
        totalCount={templates.length}
        activeGroupId={groupParam}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
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

        <details className={card}>
          <summary className={summaryLink}>+ New email template</summary>
          <form action={createEmailTemplateLib} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="groupId" value={groupParam !== "none" ? groupParam : ""} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={labelCls}>
                Name *
                <input name="name" required placeholder="Appraisal came in low" className={input} />
              </label>
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
                To (merge codes allowed)
                <input name="toDefault" placeholder="{{buyer_emails}}" className={input} />
              </label>
              <label className={labelCls}>
                Cc (merge codes allowed)
                <input name="ccDefault" placeholder="{{agent_email}}" className={input} />
              </label>
              <label className={labelCls}>
                Subject *
                <input
                  name="subject"
                  required
                  placeholder="About the appraisal — {{property_address}}"
                  className={input}
                />
              </label>
              <label className={labelCls}>
                Suggest on tasks containing
                <input name="taskMatch" placeholder="appraisal, valuation" className={input} />
              </label>
              <label className={labelCls}>
                Pre-attach documents matching
                <input
                  name="attachMatch"
                  placeholder="pre-approval, inspection"
                  className={input}
                />
              </label>
              <label className={`${labelCls} sm:col-span-2 lg:col-span-4`}>
                Note shown at compose time (never sent)
                <input
                  name="composeNote"
                  placeholder="Check the fees before sending"
                  className={input}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-700">Body *</span>
              <TemplateEditor name="body" rows={8} />
            </div>
            <button type="submit" className={`${btn} self-start`}>
              Create template
            </button>
          </form>
        </details>

        <section className={card}>
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">
              No email templates {groupParam && groupParam !== "all" ? "in this group" : "yet"}.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((t) => {
                const usedOn = usageByTemplate.get(t.id) ?? 0;
                return (
                  <li key={t.id} className="rounded-lg border border-stone-200/70">
                    <details>
                      <summary className="flex cursor-pointer select-none flex-wrap items-baseline gap-x-3 px-4 py-2 text-sm hover:bg-stone-50">
                        <span className="font-medium">{t.name.replace(" (Sample)", "")}</span>
                        <span className="text-stone-400">{t.subject}</span>
                        <span className="ml-auto flex items-center gap-2 text-xs text-stone-400">
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
                      </summary>
                      <div className="border-t border-stone-100 p-4">
                        <form action={updateEmailTemplateLib} className="flex flex-col gap-3">
                          <input type="hidden" name="id" value={t.id} />
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className={labelCls}>
                              Name
                              <input name="name" defaultValue={t.name} required className={input} />
                            </label>
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
                              To
                              <input
                                name="toDefault"
                                defaultValue={t.toDefault ?? ""}
                                className={input}
                              />
                            </label>
                            <label className={labelCls}>
                              Cc
                              <input
                                name="ccDefault"
                                defaultValue={t.ccDefault ?? ""}
                                className={input}
                              />
                            </label>
                            <label className={labelCls}>
                              Subject
                              <input
                                name="subject"
                                defaultValue={t.subject}
                                required
                                className={input}
                              />
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
                            <label className={`${labelCls} sm:col-span-2 lg:col-span-4`}>
                              Note shown at compose time
                              <input
                                name="composeNote"
                                defaultValue={t.composeNote ?? ""}
                                className={input}
                              />
                            </label>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-stone-700">Body</span>
                            <TemplateEditor name="body" defaultValue={t.body} rows={10} />
                          </div>
                          <button type="submit" className={`${btn} self-start`}>
                            Save
                          </button>
                        </form>
                        <div className="mt-3">
                          <DangerDelete
                            action={deleteEmailTemplateLib}
                            label="Delete this email template"
                            description={`Removes "${t.name}".${usedOn > 0 ? ` Still referenced by ${usedOn} task template${usedOn === 1 ? "" : "s"} — those entries will stop attaching an email.` : ""} This cannot be undone.`}
                            hidden={{ id: t.id }}
                          />
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
