import { withTenant } from "@freehold/db";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import { createPlan } from "@/lib/actions/action-plans";
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
  groupParam,
  restoredLibrary,
}: {
  tenantId: string;
  groupParam?: string;
  restoredLibrary?: string;
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

        <details className={card}>
          <summary className={summaryLink}>+ New task template</summary>
          <form action={createPlan} className="mt-4 flex flex-wrap items-end gap-3">
            <label className={label}>
              Name *
              <input name="name" required className={input} placeholder="Under Contract - Buyer" />
            </label>
            <label className={`${label} min-w-64 flex-1`}>
              Description
              <input name="description" className={input} />
            </label>
            <input type="hidden" name="groupId" value={groupParam !== "none" ? groupParam : ""} />
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
                          href={`/dashboard/action-plans/${p.id}`}
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
      </div>
    </div>
  );
}
