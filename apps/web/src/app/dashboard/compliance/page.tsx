import { ComplianceSlotStatus, ComplianceStatus, prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { Badge } from "@/components/badges";
import { BulkSelectSummary } from "@/components/bulk-select-summary";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import {
  createChecklist,
  createLendingChecklist,
  deleteChecklists,
} from "@/lib/actions/compliance";
import { SIDE_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/compliance";
import { fmtDayMonth } from "@/lib/format";
import { LENDING_DOCUMENTS } from "@/lib/lending";
import { requireTenant } from "@/lib/tenant";
import { btn, btnAdd, btnGhost, card, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** Bulk-delete target for the checklist rows. */
const BULK_FORM_ID = "checklists-bulk";

export default async function CompliancePage() {
  const { tenantId } = await requireTenant();
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { privateLendingEnabled: true },
  });
  const lendingOn = org?.privateLendingEnabled ?? false;
  const { checklists, clients, queue } = await withTenant(tenantId, async (tx) => ({
    checklists: await tx.complianceChecklist.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            items: true,
            clients: true,
            clientsBuy: true,
            clientsSell: true,
            clientsDual: true,
          },
        },
      },
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
        approvalLevels: true,
        submittedAt: true,
        transaction: {
          select: { id: true, propertyAddress: true, client: { select: { name: true } } },
        },
        slots: { select: { required: true, status: true } },
      },
    }),
  }));

  const hasLendingList = checklists.some((c) => c.side === "BORROWER");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Compliance</h1>
        <p className="text-sm text-stone-500">
          The documents a file must carry to pass review. Assign a checklist to a client and every
          transaction for them inherits the same rules — or switch compliance off for that client.
        </p>
      </div>

      <SectionCard title="Review queue">
        <p className="mb-3 text-sm text-stone-500">
          Files sent up for compliance review, longest-waiting first. Open one to approve each
          document or send it back with a note.
        </p>
        {queue.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing waiting on review.</p>
        ) : (
          <div className={tableWrap}>
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
                          {r.approvalLevels > 1 && ` · ${r.approvalLevels}-level`}
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
                          fmtDayMonth(r.submittedAt)
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Checklists"
        count={checklists.length}
        action={
          checklists.length > 0 ? (
            <div className="flex items-center gap-2">
              <BulkSelectSummary formId={BULK_FORM_ID} name="ids" />
              <button type="submit" form={BULK_FORM_ID} className={btnGhost}>
                Delete selected
              </button>
            </div>
          ) : null
        }
      >
        {/* Kept outside the table: each row links out, and a form wrapping
            the rows would swallow those. */}
        <form action={deleteChecklists} id={BULK_FORM_ID} />

        {checklists.length === 0 ? (
          <EmptyState
            title="No compliance checklists yet"
            hint="Create one below: list the documents every file needs, then assign it to the clients it applies to."
          />
        ) : (
          <div className={`${tableWrap} mb-4`}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={th} style={{ width: "2.25rem" }} aria-label="Select" />
                  <th className={th}>Name</th>
                  <th className={th}>Applies to</th>
                  <th className={th}>Required documents</th>
                  <th className={th}>Clients using it</th>
                  <th className={`${th} text-right`} style={{ width: "5rem" }} aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {checklists.map((c) => (
                  <tr key={c.id} className={trHover}>
                    <td className={td}>
                      <input
                        type="checkbox"
                        name="ids"
                        value={c.id}
                        form={BULK_FORM_ID}
                        aria-label={`Select ${c.name}`}
                        className="accent-brand-600"
                      />
                    </td>
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
                    <td className={td}>
                      <Badge tone="neutral">{SIDE_LABEL[c.side]}</Badge>
                    </td>
                    <td className={td}>{c._count.items}</td>
                    <td className={td}>
                      {c._count.clients +
                        c._count.clientsBuy +
                        c._count.clientsSell +
                        c._count.clientsDual}
                    </td>
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/dashboard/compliance/${c.id}`}
                        className="text-xs text-stone-500 hover:text-brand-700"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <details>
            <summary className={`${btnAdd} w-fit cursor-pointer list-none`}>
              + New checklist
            </summary>
            <form
              action={createChecklist}
              className={`${card} mt-3 flex flex-wrap items-end gap-3`}
            >
              <label className={label}>
                Name
                <input name="name" required className={input} placeholder="Buy-side file, Texas" />
              </label>
              <label className={`${label} min-w-64 flex-1`}>
                Description
                <input
                  name="description"
                  className={input}
                  placeholder="What this checklist covers"
                />
              </label>
              <label className={label}>
                Applies to
                <select name="side" defaultValue="BOTH" className={input}>
                  <option value="BOTH">{SIDE_LABEL.BOTH}</option>
                  <option value="BUY_SIDE">{SIDE_LABEL.BUY_SIDE}</option>
                  <option value="SELL_SIDE">{SIDE_LABEL.SELL_SIDE}</option>
                  <option value="DUAL">{SIDE_LABEL.DUAL}</option>
                  {lendingOn && <option value="BORROWER">{SIDE_LABEL.BORROWER}</option>}
                </select>
              </label>
              <button type="submit" className={btn}>
                Create checklist
              </button>
            </form>
          </details>

          {/* Thirteen documents is a lot to type, and a missing one surfaces
              at underwriting rather than here. Only offered while the
              workspace hasn't got a lending list yet. */}
          {lendingOn && !hasLendingList && (
            <form action={createLendingChecklist}>
              <button type="submit" className={btnAdd}>
                + Standard lending package ({LENDING_DOCUMENTS.length} documents)
              </button>
            </form>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Who compliance applies to">
        <p className="mb-3 text-sm text-stone-500">
          Set each client's rules on their profile. A client with compliance off, or with no
          checklist assigned, has no document requirements.
        </p>
        {clients.length === 0 ? (
          <p className="text-sm text-stone-400">No clients yet.</p>
        ) : (
          <div className={tableWrap}>
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
          </div>
        )}
      </SectionCard>
    </div>
  );
}
