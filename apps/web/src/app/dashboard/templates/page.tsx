import { withTenant } from "@freehold/db";
import Link from "next/link";
import { createTemplate } from "@/lib/actions/templates";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, td, th } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { tenantId } = await requireTenant();
  const templates = await withTenant(tenantId, (tx) =>
    tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Document templates</h1>
        <p className="text-sm text-stone-500">
          Reusable letters and forms with merge fields like{" "}
          <code>{"{{transaction.closeDate}}"}</code> — generate a filled PDF on any transaction.
        </p>
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-medium text-brand-700">New template</summary>
        <form action={createTemplate} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={label}>
            Name *
            <input name="name" required className={input} placeholder="Closing intro letter" />
          </label>
          <label className={`${label} min-w-64 flex-1`}>
            Description
            <input name="description" className={input} />
          </label>
          <button type="submit" className={btn}>
            Create & edit
          </button>
        </form>
      </details>

      <section className={card}>
        {templates.length === 0 ? (
          <p className="text-sm text-stone-500">No templates yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Description</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/templates/${t.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className={td}>{t.description ?? "—"}</td>
                  <td className={td}>{fmtDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
