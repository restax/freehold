import { withTenant } from "@freehold/db";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/badges";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BulkSelectSummary } from "@/components/bulk-select-summary";
import { DangerDelete } from "@/components/danger-delete";
import { EmptyState } from "@/components/empty-state";
import { SaveButton } from "@/components/save-button";
import { SectionCard } from "@/components/section-card";
import {
  addChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  deleteChecklistItems,
  updateChecklist,
  updateChecklistItem,
} from "@/lib/actions/compliance";
import { SIDE_LABEL } from "@/lib/compliance";
import { requireAdminTenant } from "@/lib/tenant";
import { btn, btnAdd, btnGhost, input, label, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** The bulk-delete form lives outside the table so rows can hold their own
 *  forms; every checkbox points back at it by id. Same pattern as the
 *  Attachments tab. */
const BULK_FORM_ID = "checklist-items-bulk";

export default async function ComplianceChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;
  // Which row is open for editing, kept in the URL so the page stays a server
  // component and the state survives the save.
  const { edit } = await searchParams;

  const checklist = await withTenant(tenantId, (tx) =>
    tx.complianceChecklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        clients: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        clientsBuy: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        clientsSell: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        clientsDual: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  );
  if (!checklist) notFound();

  const requiredCount = checklist.items.filter((i) => i.required).length;
  // A client can reach this list through any of four assignments; show each
  // one once, with what it covers for them.
  const usedBy = new Map<string, { id: string; name: string; how: string[] }>();
  const note = (list: Array<{ id: string; name: string }>, how: string) => {
    for (const c of list) {
      const cur = usedBy.get(c.id) ?? { id: c.id, name: c.name, how: [] };
      cur.how.push(how);
      usedBy.set(c.id, cur);
    }
  };
  note(checklist.clients, "all sides");
  note(checklist.clientsBuy, "buy side");
  note(checklist.clientsSell, "sell side");
  note(checklist.clientsDual, "dual");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Compliance", href: "/dashboard/compliance" },
              { label: checklist.name },
            ]}
          />
          {isAdmin && (
            <DangerDelete
              compact
              action={deleteChecklist}
              label="Delete checklist"
              description="Removes this checklist and its documents."
              hidden={{ id: checklist.id }}
            />
          )}
        </div>
        <h1 className="text-xl font-semibold">{checklist.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <Badge tone="neutral">{SIDE_LABEL[checklist.side]}</Badge>
          {checklist.description ? <span>{checklist.description}</span> : null}
          <span>
            {requiredCount} required
            {checklist.items.length - requiredCount > 0
              ? `, ${checklist.items.length - requiredCount} optional`
              : ""}
          </span>
        </p>
      </div>

      {isAdmin && (
        <SectionCard title="Checklist details">
          <form action={updateChecklist} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={checklist.id} />
            <label className={`${label} min-w-56 flex-1`}>
              Name
              <input name="name" required defaultValue={checklist.name} className={input} />
            </label>
            <label className={`${label} min-w-56 flex-1`}>
              Description
              <input
                name="description"
                defaultValue={checklist.description ?? ""}
                placeholder="What this list covers"
                className={input}
              />
            </label>
            <label className={label}>
              Applies to
              <select name="side" defaultValue={checklist.side} className={input}>
                <option value="BOTH">Any side</option>
                <option value="BUY_SIDE">Buy side</option>
                <option value="SELL_SIDE">Sell side</option>
                <option value="DUAL">Dual</option>
              </select>
            </label>
            <label className={label}>
              Approval levels
              <select
                name="approvalLevels"
                defaultValue={String(checklist.approvalLevels)}
                className={input}
              >
                <option value="1">1, single sign-off</option>
                <option value="2">2 levels</option>
                <option value="3">3 levels</option>
              </select>
            </label>
            <SaveButton className={btn} />
          </form>
          <p className="mt-2 text-xs text-stone-400">
            Side steers which of a client's per-side defaults this list fills, and warns on an odd
            pairing. It never stops you applying a list to a file. Rounds already in flight keep the
            approval policy they started with; set who reviews at which level on the{" "}
            <Link href="/dashboard/team" className="text-brand-700 hover:underline">
              Team
            </Link>{" "}
            page.
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="Required documents"
        count={checklist.items.length}
        action={
          checklist.items.length > 0 ? (
            <div className="flex items-center gap-2">
              <BulkSelectSummary formId={BULK_FORM_ID} name="ids" />
              <button type="submit" form={BULK_FORM_ID} className={btnGhost}>
                Delete selected
              </button>
            </div>
          ) : null
        }
      >
        <p className="mb-3 text-sm text-stone-500">
          Every file under this checklist must carry these. Optional items are tracked but never
          block a file from passing.
        </p>

        {/* Outside the table: rows carry their own edit forms, and nested
            forms are invalid HTML. */}
        <form action={deleteChecklistItems} id={BULK_FORM_ID}>
          <input type="hidden" name="checklistId" value={checklist.id} />
        </form>

        {checklist.items.length === 0 ? (
          <EmptyState
            title="No documents on this checklist yet"
            hint="Add the first one below, for example “Purchase agreement” or “Seller disclosure”."
          />
        ) : (
          <table className="mb-4 w-full">
            <thead>
              <tr>
                <th className={th} style={{ width: "2.25rem" }} aria-label="Select" />
                <th className={th}>Document</th>
                <th className={th}>Requirement</th>
                <th className={`${th} text-right`} style={{ width: "9rem" }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {checklist.items.map((item) =>
                edit === item.id ? (
                  <tr key={item.id} className="bg-brand-50/40">
                    <td className={td} />
                    <td className={td} colSpan={3}>
                      <form
                        action={updateChecklistItem}
                        className="flex flex-wrap items-end gap-2 py-1"
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="checklistId" value={checklist.id} />
                        <label className={`${label} min-w-48 flex-1`}>
                          Document name
                          <input name="name" required defaultValue={item.name} className={input} />
                        </label>
                        <label className={`${label} min-w-48 flex-1`}>
                          Note
                          <input
                            name="description"
                            defaultValue={item.description ?? ""}
                            className={input}
                          />
                        </label>
                        <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            name="required"
                            defaultChecked={item.required}
                            className="accent-brand-600"
                          />
                          Required
                        </label>
                        <SaveButton className={btn} />
                        <Link
                          href={`/dashboard/compliance/${checklist.id}`}
                          scroll={false}
                          className={btnGhost}
                        >
                          Cancel
                        </Link>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className={trHover}>
                    <td className={td}>
                      <input
                        type="checkbox"
                        name="ids"
                        value={item.id}
                        form={BULK_FORM_ID}
                        aria-label={`Select ${item.name}`}
                        className="accent-brand-600"
                      />
                    </td>
                    <td className={td}>
                      <Link
                        href={`/dashboard/compliance/${checklist.id}?edit=${item.id}`}
                        scroll={false}
                        className="font-medium hover:text-brand-700 hover:underline"
                      >
                        {item.name}
                      </Link>
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
                    <td className={`${td} text-right`}>
                      <span className="flex items-center justify-end gap-3">
                        <Link
                          href={`/dashboard/compliance/${checklist.id}?edit=${item.id}`}
                          scroll={false}
                          className="text-xs text-stone-500 hover:text-brand-700"
                        >
                          Edit
                        </Link>
                        {/* One line off a template is trivially re-added, so
                            this is a plain button rather than the type-DELETE
                            confirm used for destroying a whole checklist. */}
                        <form action={deleteChecklistItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="checklistId" value={checklist.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 transition-colors hover:text-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}

        <details className="group">
          <summary className={`${btnAdd} inline-flex cursor-pointer list-none`}>
            <Plus size={14} weight="bold" aria-hidden />
            New document
          </summary>
          <form action={addChecklistItem} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="checklistId" value={checklist.id} />
            <label className={label}>
              Document name
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
        </details>
      </SectionCard>

      <SectionCard title="Clients using this checklist" count={usedBy.size}>
        {usedBy.size === 0 ? (
          <p className="text-sm text-stone-500">
            Not assigned yet. Open a client and set their compliance rules to apply this checklist
            to their files.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...usedBy.values()].map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="text-brand-700 hover:text-brand-600"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-stone-400">{c.how.join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
