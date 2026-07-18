import { withTenant } from "@freehold/db";
import Link from "next/link";
import { createPlan } from "@/lib/actions/action-plans";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, td, th } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ActionPlansPage() {
  const { tenantId } = await requireTenant();
  const plans = await withTenant(tenantId, (tx) =>
    tx.actionPlan.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { tasks: true } } },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Action plans</h1>
        <p className="text-sm text-stone-500">
          Reusable checklists. Each template task anchors to the contract or close date with a day
          offset, so applying a plan gives every task a real deadline.
        </p>
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-medium text-brand-700">New action plan</summary>
        <form action={createPlan} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={label}>
            Name *
            <input name="name" required className={input} placeholder="Texas buy-side closing" />
          </label>
          <label className={`${label} min-w-64 flex-1`}>
            Description
            <input name="description" className={input} />
          </label>
          <button type="submit" className={btn}>
            Create plan
          </button>
        </form>
      </details>

      <section className={card}>
        {plans.length === 0 ? (
          <p className="text-sm text-stone-500">No action plans yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Description</th>
                <th className={th}>Tasks</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/action-plans/${p.id}`}
                      className="text-brand-600 hover:underline"
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
        )}
      </section>
    </div>
  );
}
