import { withTenant } from "@freehold/db";
import Link from "next/link";
import { ActionPlanDependencyTree } from "@/components/action-plan-dependency-tree";
import { ActionPlanTaskGrid } from "@/components/action-plan-task-grid";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import {
  addTemplateDocument,
  createPlan,
  deletePlan,
  deleteTemplateDocument,
  movePlanGroup,
} from "@/lib/actions/action-plans";
import { restoreStarterLibrary } from "@/lib/actions/templates";
import {
  btn,
  btnGhost,
  card,
  input,
  label,
  summaryLink,
  tableWrap,
  td,
  th,
  trHover,
} from "@/lib/ui";

export async function TemplatesTabTasks({
  tenantId,
  isAdmin,
  groupParam,
  restoredLibrary,
  planId,
}: {
  tenantId: string;
  isAdmin: boolean;
  groupParam?: string;
  restoredLibrary?: string;
  planId?: string;
}) {
  const [plans, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.actionPlan.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tasks: true } } },
      }),
      tx.templateGroup.findMany({ where: { kind: "TASK" }, orderBy: { sortOrder: "asc" } }),
    ]),
  );

  const railGroups: RailGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    count: plans.filter((p) => p.groupId === g.id).length,
  }));
  const noGroupCount = plans.filter((p) => !p.groupId).length;
  const visible =
    !groupParam || groupParam === "all"
      ? plans
      : groupParam === "none"
        ? plans.filter((p) => !p.groupId)
        : plans.filter((p) => p.groupId === groupParam);

  const selected = planId ? plans.find((p) => p.id === planId) : undefined;
  const detail = selected
    ? await withTenant(tenantId, (tx) =>
        Promise.all([
          tx.actionPlan.findUnique({
            where: { id: selected.id },
            include: {
              tasks: { orderBy: { sortOrder: "asc" } },
              documents: { orderBy: { sortOrder: "asc" } },
            },
          }),
          tx.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
          tx.attachmentTemplate.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          }),
          tx.dateTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
          tx.docTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        ]),
      )
    : null;
  const [plan, emailTemplates, attachmentTemplates, dateTemplates, docTemplates] = detail ?? [
    null,
    [],
    [],
    [],
    [],
  ];

  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No group") : "No group";
  const listHref = (id?: string) => `/dashboard/templates?tab=tasks${id ? `&group=${id}` : ""}`;
  const planHref = (id: string) =>
    `/dashboard/templates?tab=tasks${groupParam ? `&group=${groupParam}` : ""}&planId=${id}`;

  return (
    <div className="flex gap-6">
      <TemplateGroupRail
        kind="TASK"
        tab="tasks"
        groups={railGroups}
        noGroupCount={noGroupCount}
        totalCount={plans.length}
        activeGroupId={groupParam}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {!planId && (
          <>
            {restoredLibrary !== undefined && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {Number(restoredLibrary) > 0
                  ? `Restored ${restoredLibrary} starter-library item${restoredLibrary === "1" ? "" : "s"}.`
                  : "You already have the whole starter library."}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-stone-500">
                Reusable checklists. Each entry anchors to a transaction date with a day offset — or
                to another entry's completion — so applying a plan gives every task a real deadline.
              </p>
              <form action={restoreStarterLibrary}>
                <button type="submit" className={btnGhost}>
                  Restore starter templates
                </button>
              </form>
            </div>

            <details className={card}>
              <summary className={summaryLink}>+ New task template</summary>
              <form action={createPlan} className="mt-4 flex flex-wrap items-end gap-3">
                <label className={label}>
                  Name *
                  <input
                    name="name"
                    required
                    className={input}
                    placeholder="Under Contract - Buyer"
                  />
                </label>
                <label className={`${label} min-w-64 flex-1`}>
                  Description
                  <input name="description" className={input} />
                </label>
                <input
                  type="hidden"
                  name="groupId"
                  value={groupParam !== "none" ? groupParam : ""}
                />
                <button type="submit" className={btn}>
                  Create
                </button>
              </form>
            </details>

            <section className={card}>
              {visible.length === 0 ? (
                <EmptyState
                  title="No task templates yet"
                  hint="Build your closing checklist once — each step anchored to a transaction date — and apply it to every new deal for instant deadlines."
                />
              ) : (
                <div className={tableWrap}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={th}>Name</th>
                        <th className={th}>Description</th>
                        <th className={th}>Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id} className={trHover}>
                          <td className={td}>
                            <Link
                              href={planHref(p.id)}
                              className="font-medium text-brand-700 hover:text-brand-600"
                            >
                              {p.name}
                            </Link>
                          </td>
                          <td className={td}>{p.description ?? "—"}</td>
                          <td className={td}>{p._count.tasks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {planId && !plan && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
            <p>That task template wasn't found — it may have been deleted.</p>
            <Link href={listHref()} className="text-brand-700 hover:underline">
              Back to task templates
            </Link>
          </div>
        )}

        {plan && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Breadcrumbs
                  items={[
                    { label: "Templates", href: listHref() },
                    { label: "Tasks", href: listHref() },
                    { label: groupName(plan.groupId) },
                    { label: plan.name },
                  ]}
                />
                <h2 className="mt-1 text-lg font-semibold">{plan.name}</h2>
                {plan.description && <p className="text-sm text-stone-500">{plan.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <form action={movePlanGroup} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={plan.id} />
                  <select name="groupId" defaultValue={plan.groupId ?? ""} className={input}>
                    <option value="">No group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={btnGhost}>
                    Move
                  </button>
                </form>
                {isAdmin && (
                  <DangerDelete
                    compact
                    action={deletePlan}
                    label="Delete plan"
                    description="Removes this checklist template (tasks already applied to transactions are kept)."
                    hidden={{ id: plan.id }}
                  />
                )}
              </div>
            </div>

            <section className={card}>
              <ActionPlanTaskGrid
                planId={plan.id}
                tasks={plan.tasks}
                emailTemplates={emailTemplates}
                attachmentTemplates={attachmentTemplates}
                dateTemplates={dateTemplates}
                docTemplates={docTemplates}
              />
            </section>

            <SectionCard title="Dependency chains">
              <p className="mb-3 text-sm text-stone-500">
                Tasks that wait on another task finishing rather than on a date from the file. They
                land undated when the plan is applied, and get their due date the moment the task
                above them is completed.
              </p>
              <ActionPlanDependencyTree tasks={plan.tasks} />
            </SectionCard>

            <SectionCard title="Required documents">
              <p className="mb-3 text-sm text-stone-500">
                The documents a file on this plan should collect. Applying the plan drops this
                checklist onto the transaction's Documents tab, each one marked received or missing.
              </p>
              {plan.documents.length === 0 ? (
                <p className="mb-3 text-sm text-stone-400">
                  No required documents yet — add one below.
                </p>
              ) : (
                <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                  {plan.documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span>{d.label}</span>
                      <form action={deleteTemplateDocument}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="actionPlanId" value={plan.id} />
                        <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                          remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addTemplateDocument} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="actionPlanId" value={plan.id} />
                <label className={`${label} min-w-64 flex-1`}>
                  Document
                  <input
                    name="label"
                    required
                    className={input}
                    placeholder="Purchase & Sale Agreement"
                  />
                </label>
                <button type="submit" className={btnGhost}>
                  Add required document
                </button>
              </form>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
