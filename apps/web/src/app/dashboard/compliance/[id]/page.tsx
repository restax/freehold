import { withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badges";
import { DangerDelete } from "@/components/danger-delete";
import { EmptyState } from "@/components/empty-state";
import {
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  setChecklistApprovalLevels,
} from "@/lib/actions/compliance";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, card, input, label, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ComplianceChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;

  const checklist = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        clients: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  );
  if (!checklist) notFound();

  const requiredCount = checklist.items.filter((i) => i.required).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/dashboard/compliance" className="text-sm text-stone-500 hover:underline">
          ← Compliance
        </Link>
        <h1 className="text-xl font-semibold">{checklist.name}</h1>
        <p className="text-sm text-stone-500">
          {checklist.description ? `${checklist.description} · ` : ""}
          {requiredCount} required
          {checklist.items.length - requiredCount > 0
            ? `, ${checklist.items.length - requiredCount} optional`
            : ""}
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-1 font-medium">Required documents</h2>
        <p className="mb-3 text-sm text-stone-500">
          Every file under this checklist must carry these. Optional items are tracked but never
          block a file from passing.
        </p>
        {checklist.items.length === 0 ? (
          <EmptyState
            title="No documents on this checklist yet"
            hint="Add the first one below — for example “Purchase agreement” or “Seller disclosure”."
          />
        ) : (
          <table className="mb-4 w-full">
            <thead>
              <tr>
                <th className={th}>Document</th>
                <th className={th}>Requirement</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {checklist.items.map((item) => (
                <tr key={item.id} className={trHover}>
                  <td className={td}>
                    <span className="font-medium">{item.name}</span>
                    {item.description && (
                      <span className="ml-2 text-xs text-stone-400">{item.description}</span>
                    )}
                  </td>
                  <td className={td}>
                    {item.required ? (
                      <Badge tone="danger">required</Badge>
                    ) : (
                      <Badge tone="neutral">optional</Badge>
                    )}
                  </td>
                  <td className={td}>
                    <form action={deleteChecklistItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="checklistId" value={checklist.id} />
                      <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                        remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={addChecklistItem} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="checklistId" value={checklist.id} />
          <label className={label}>
            Document name *
            <input name="name" required className={input} placeholder="Purchase agreement" />
          </label>
          <label className={`${label} min-w-56 flex-1`}>
            Note
            <input name="description" className={input} placeholder="Fully executed, all pages" />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
            <input type="checkbox" name="required" defaultChecked className="accent-brand-600" />
            Required
          </label>
          <button type="submit" className={btn}>
            Add document
          </button>
        </form>
      </section>

      {isAdmin && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Review policy</h2>
          <p className="mb-3 text-sm text-stone-500">
            How many levels of reviewer sign-off each document needs. One level means any reviewer's
            approval passes it; more levels make it climb the ladder — set who reviews at which
            level on the{" "}
            <Link href="/dashboard/team" className="text-brand-700 hover:underline">
              Team
            </Link>{" "}
            page. Rounds already in flight keep the policy they started with.
          </p>
          <form action={setChecklistApprovalLevels} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="checklistId" value={checklist.id} />
            <label className={label}>
              Approval levels
              <select
                name="approvalLevels"
                defaultValue={String(checklist.approvalLevels)}
                className={input}
              >
                <option value="1">1 — single sign-off</option>
                <option value="2">2 — two levels</option>
                <option value="3">3 — three levels</option>
              </select>
            </label>
            <button type="submit" className={btn}>
              Save
            </button>
          </form>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-1 font-medium">Clients using this checklist</h2>
        {checklist.clients.length === 0 ? (
          <p className="text-sm text-stone-500">
            Not assigned yet. Open a client and set their compliance rules to apply this checklist
            to every one of their files.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {checklist.clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="text-brand-700 hover:text-brand-600"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Danger zone</h2>
          <p className="mb-3 text-sm text-stone-500">
            Deleting a checklist leaves the clients using it with no document requirements.
          </p>
          <DangerDelete
            action={deleteChecklist}
            label="Delete checklist"
            description="Removes this checklist and its documents."
            hidden={{ id: checklist.id }}
          />
        </section>
      )}
    </div>
  );
}
