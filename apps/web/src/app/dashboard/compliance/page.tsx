import { ComplianceSlotStatus, ComplianceStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { createChecklist } from "@/lib/actions/compliance";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/compliance";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const { tenantId } = await requireTenant();
  const { checklists, clients, queue } = await withTenant(tenantId, async (tx) => ({
    checklists: await tx.complianceChecklist.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true, clients: true } } },
    }),
    clients: await tx.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        complianceEnabled: true,
        complianceChecklist: { select: { name: true } },
      },
    }),
    // Everything a reviewer still owes an answer on: sent up for review, or
    // sent back and waiting on the submitter. Oldest submission first — the
    // file that has been waiting longest is the one to work next.
    queue: await tx.transactionCompliance.findMany({
      where: {
        isCurrent: true,
        status: { in: [ComplianceStatus.SUBMITTED, ComplianceStatus.CHANGES_REQUESTED] },
      },
      orderBy: [{ submittedAt: "asc" }],
      select: {
        id: true,
        status: true,
        version: true,
        checklistName: true,
        submittedAt: true,
        transaction: {
          select: { id: true, propertyAddress: true, client: { select: { name: true } } },
        },
        slots: { select: { required: true, status: true } },
      },
    }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Compliance</h1>
        <p className="text-sm text-stone-500">
          The documents a file must carry to pass review. Assign a checklist to a client and every
          transaction for them inherits the same rules — or switch compliance off for that client.
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-1 font-medium">Review queue</h2>
        <p className="mb-3 text-sm text-stone-500">
          Files sent up for compliance review, longest-waiting first. Open one to approve each
          document or send it back with a note.
        </p>
        {queue.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing waiting on review.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>File</th>
                <th className={th}>Client</th>
                <th className={th}>Status</th>
                <th className={th}>Awaiting you</th>
                <th className={th}>Required approved</th>
                <th className={th}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => {
                const awaiting = r.slots.filter(
                  (s) => s.status === ComplianceSlotStatus.SUBMITTED,
                ).length;
                const required = r.slots.filter((s) => s.required);
                const approved = required.filter(
                  (s) => s.status === ComplianceSlotStatus.APPROVED,
                ).length;
                return (
                  <tr key={r.id} className={trHover}>
                    <td className={td}>
                      <Link
                        href={`/dashboard/transactions/${r.transaction.id}?tab=compliance`}
                        className="font-medium text-brand-700 hover:text-brand-600"
                      >
                        {r.transaction.propertyAddress}
                      </Link>
                      <span className="ml-2 text-xs text-stone-400">
                        {r.checklistName} · v{r.version}
                      </span>
                    </td>
                    <td className={td}>
                      {r.transaction.client?.name ?? <span className="text-stone-300">—</span>}
                    </td>
                    <td className={td}>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className={td}>
                      {awaiting > 0 ? awaiting : <span className="text-stone-300">—</span>}
                    </td>
                    <td className={td}>
                      {approved} / {required.length}
                    </td>
                    <td className={td}>
                      {r.submittedAt ? (
                        fmtDate(r.submittedAt)
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <details className={card}>
        <summary className={summaryLink}>New checklist</summary>
        <form action={createChecklist} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={label}>
            Name *
            <input name="name" required className={input} placeholder="Buy-side file — Texas" />
          </label>
          <label className={`${label} min-w-64 flex-1`}>
            Description
            <input name="description" className={input} placeholder="What this checklist covers" />
          </label>
          <button type="submit" className={btn}>
            Create checklist
          </button>
        </form>
      </details>

      <section className={card}>
        <h2 className="mb-3 font-medium">Checklists</h2>
        {checklists.length === 0 ? (
          <EmptyState
            title="No compliance checklists yet"
            hint="Create one above — list the documents every file needs, then assign it to the clients it applies to."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Required documents</th>
                <th className={th}>Clients using it</th>
              </tr>
            </thead>
            <tbody>
              {checklists.map((c) => (
                <tr key={c.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/compliance/${c.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {c.name}
                    </Link>
                    {c.description && (
                      <span className="ml-2 text-xs text-stone-400">{c.description}</span>
                    )}
                  </td>
                  <td className={td}>{c._count.items}</td>
                  <td className={td}>{c._count.clients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Who compliance applies to</h2>
        <p className="mb-3 text-sm text-stone-500">
          Set each client's rules on their profile. A client with compliance off, or with no
          checklist assigned, has no document requirements.
        </p>
        {clients.length === 0 ? (
          <p className="text-sm text-stone-400">No clients yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Client</th>
                <th className={th}>Compliance</th>
                <th className={th}>Checklist</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((cl) => (
                <tr key={cl.id} className={trHover}>
                  <td className={td}>
                    <Link
                      href={`/dashboard/clients/${cl.id}`}
                      className="font-medium text-brand-700 hover:text-brand-600"
                    >
                      {cl.name}
                    </Link>
                  </td>
                  <td className={td}>
                    {cl.complianceEnabled ? (
                      <span className="text-stone-700">On</span>
                    ) : (
                      <span className="text-stone-400">Off</span>
                    )}
                  </td>
                  <td className={td}>
                    {cl.complianceChecklist?.name ?? <span className="text-stone-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
