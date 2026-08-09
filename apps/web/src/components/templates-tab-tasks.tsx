import { prisma, withTenant } from "@freehold/db";
import { ActionPlanDependencyTree } from "@/components/action-plan-dependency-tree";
import { ActionPlanTaskGrid } from "@/components/action-plan-task-grid";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { SectionCard } from "@/components/section-card";
import { TemplateTree } from "@/components/template-tree";
import {
  addTemplateDocument,
  createPlan,
  deletePlan,
  deleteTemplateDocument,
  movePlanGroup,
} from "@/lib/actions/action-plans";
import { restoreStarterLibrary } from "@/lib/actions/templates";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

export async function TemplatesTabTasks({
  tenantId,
  isAdmin,
  restoredLibrary,
  planId,
  folderParam,
}: {
  tenantId: string;
  isAdmin: boolean;
  restoredLibrary?: string;
  planId?: string;
  folderParam?: string;
}) {
  // The lending side is only worth offering as a scope to a workspace that
  // actually takes private lending work.
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { privateLendingEnabled: true },
  });
  const lendingOn = org?.privateLendingEnabled ?? false;
  const [plans, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.actionPlan.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tasks: true } } },
      }),
      tx.templateGroup.findMany({ where: { kind: "TASK" }, orderBy: { sortOrder: "asc" } }),
    ]),
  );

  const isNew = planId === "new";
  const selected = !isNew ? plans.find((p) => p.id === planId) : undefined;
  const newGroupId = folderParam && folderParam !== "none" ? folderParam : "";

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
    id ? (groups.find((g) => g.id === id)?.name ?? "No folder") : "No folder";

  return (
    <div className="flex flex-col gap-4">
      {restoredLibrary !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {Number(restoredLibrary) > 0
            ? `Restored ${restoredLibrary} starter-library item${restoredLibrary === "1" ? "" : "s"}.`
            : "You already have the whole starter library."}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          Reusable checklists. Each entry anchors to a transaction date with a day offset — or to
          another entry's completion — so applying a plan gives every task a real deadline.
        </p>
        <form action={restoreStarterLibrary}>
          <button type="submit" className={btnGhost}>
            Restore starter templates
          </button>
        </form>
      </div>

      <div className="flex gap-6">
        <TemplateTree
          kind="TASK"
          tab="tasks"
          idParam="planId"
          label="Task templates"
          newLabel="New task template"
          items={plans.map((p) => ({ id: p.id, name: p.name, groupId: p.groupId }))}
          groups={groups}
          selectedId={isNew ? "new" : selected?.id}
          selectedGroupId={isNew ? (folderParam ?? null) : (selected?.groupId ?? null)}
        />

        <div className="min-w-0 flex-1">
          {!isNew && !selected && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
              <p>Select a task template on the left, or create a new one.</p>
            </div>
          )}

          {isNew && (
            <div className="flex flex-col gap-2">
              <Breadcrumbs
                items={[
                  { label: "Templates", href: "/dashboard/templates?tab=tasks" },
                  { label: "Tasks", href: "/dashboard/templates?tab=tasks" },
                  { label: groupName(newGroupId || null) },
                  { label: "New task template" },
                ]}
              />
              <section className={card}>
                <form action={createPlan} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="groupId" value={newGroupId} />
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
                  <button type="submit" className={btn}>
                    Create
                  </button>
                </form>
              </section>
            </div>
          )}

          {plan && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Breadcrumbs
                    items={[
                      { label: "Templates", href: "/dashboard/templates?tab=tasks" },
                      { label: "Tasks", href: "/dashboard/templates?tab=tasks" },
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
                      <option value="">No folder</option>
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
                  lendingOn={lendingOn}
                />
              </section>

              <SectionCard title="Dependency chains">
                <p className="mb-3 text-sm text-stone-500">
                  Tasks that wait on another task finishing rather than on a date from the file.
                  They land undated when the plan is applied, and get their due date the moment the
                  task above them is completed.
                </p>
                <ActionPlanDependencyTree tasks={plan.tasks} />
              </SectionCard>

              <SectionCard title="Required documents">
                <p className="mb-3 text-sm text-stone-500">
                  The documents a file on this plan should collect. Applying the plan drops this
                  checklist onto the transaction's Documents tab, each one marked received or
                  missing.
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
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
