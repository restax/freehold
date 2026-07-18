import { DateAnchor, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addTemplateTask, deletePlan, deleteTemplateTask } from "@/lib/actions/action-plans";
import { requireTenant } from "@/lib/tenant";
import { btnDanger, btnGhost, card, input, label, td, th } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ANCHOR_LABEL: Record<string, string> = {
  CONTRACT_DATE: "Contract date",
  CLOSE_DATE: "Close date",
};

function offsetLabel(days: number): string {
  if (days === 0) return "on the day";
  return days > 0 ? `+${days} days` : `${days} days`;
}

export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id } = await params;
  const plan = await withTenant(tenantId, (tx) =>
    tx.actionPlan.findUnique({
      where: { id },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    }),
  );
  if (!plan) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/action-plans" className="text-sm text-stone-500 hover:underline">
            ← Action plans
          </Link>
          <h1 className="text-xl font-semibold">{plan.name}</h1>
          {plan.description && <p className="text-sm text-stone-500">{plan.description}</p>}
        </div>
        <form action={deletePlan}>
          <input type="hidden" name="id" value={plan.id} />
          <button type="submit" className={btnDanger}>
            Delete plan
          </button>
        </form>
      </div>

      <section className={card}>
        {plan.tasks.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">
            No template tasks yet — add the first below.
          </p>
        ) : (
          <table className="mb-4 w-full">
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>Task</th>
                <th className={th}>Anchor</th>
                <th className={th}>Offset</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {plan.tasks.map((t) => (
                <tr key={t.id}>
                  <td className={td}>{t.sortOrder}</td>
                  <td className={`${td} font-medium`}>{t.title}</td>
                  <td className={td}>{ANCHOR_LABEL[t.anchor]}</td>
                  <td className={td}>{offsetLabel(t.offsetDays)}</td>
                  <td className={td}>
                    <form action={deleteTemplateTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="actionPlanId" value={plan.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                        delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={addTemplateTask} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="actionPlanId" value={plan.id} />
          <label className={`${label} min-w-64 flex-1`}>
            Task title *
            <input name="title" required className={input} placeholder="Order title commitment" />
          </label>
          <label className={label}>
            Anchor
            <select name="anchor" className={input} defaultValue={DateAnchor.CLOSE_DATE}>
              {Object.values(DateAnchor).map((a) => (
                <option key={a} value={a}>
                  {ANCHOR_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Offset (days)
            <input name="offsetDays" type="number" defaultValue={0} className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Add template task
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-400">
          Negative offsets fall before the anchor: “Close date, −1” is the day before closing.
        </p>
      </section>
    </div>
  );
}
