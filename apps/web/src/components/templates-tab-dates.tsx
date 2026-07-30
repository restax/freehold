import { DateAnchor, withTenant } from "@freehold/db";
import { DangerDelete } from "@/components/danger-delete";
import { type RailGroup, TemplateGroupRail } from "@/components/template-group-rail";
import {
  addDateTemplateItem,
  createDateTemplate,
  deleteDateTemplate,
  deleteDateTemplateItem,
} from "@/lib/actions/date-templates";
import { btn, btnGhost, card, input, label, summaryLink } from "@/lib/ui";

const ANCHOR_LABEL: Record<string, string> = {
  CONTRACT_DATE: "contract date",
  CLOSE_DATE: "close date",
  LIST_DATE: "list date",
  EXPIRE_DATE: "listing expiration",
  MORTGAGE_COMMITMENT_DATE: "mortgage commitment",
  INSPECTION_DEADLINE_DATE: "inspection deadline",
  EARNEST_MONEY_DUE_DATE: "earnest money due",
  TEMPLATE_START: "the day applied",
  DEPENDENCY: "another entry's completion",
};

export async function TemplatesTabDates({
  tenantId,
  groupParam,
}: {
  tenantId: string;
  groupParam?: string;
}) {
  const [templates, groups] = await withTenant(tenantId, (tx) =>
    Promise.all([
      tx.dateTemplate.findMany({
        orderBy: { name: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      }),
      tx.templateGroup.findMany({ where: { kind: "DATE" }, orderBy: { sortOrder: "asc" } }),
    ]),
  );

  const railGroups: RailGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    count: templates.filter((t) => t.groupId === g.id).length,
  }));
  const noGroupCount = templates.filter((t) => !t.groupId).length;
  const visible =
    !groupParam || groupParam === "all"
      ? templates
      : groupParam === "none"
        ? templates.filter((t) => !t.groupId)
        : templates.filter((t) => t.groupId === groupParam);

  return (
    <div className="flex gap-6">
      <TemplateGroupRail
        kind="DATE"
        tab="dates"
        groups={railGroups}
        noGroupCount={noGroupCount}
        totalCount={templates.length}
        activeGroupId={groupParam}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-sm text-stone-500">
          Named sets of key dates with a suggested calculator per date. Applying one proposes
          computed values on a transaction — you confirm or override every one.
        </p>

        <details className={card}>
          <summary className={summaryLink}>+ New key-dates template</summary>
          <form action={createDateTemplate} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="groupId" value={groupParam !== "none" ? groupParam : ""} />
            <label className={label}>
              Name *
              <input name="name" required className={input} placeholder="Contract dates" />
            </label>
            <label className={`${label} min-w-64 flex-1`}>
              Description
              <input name="description" className={input} />
            </label>
            <button type="submit" className={btn}>
              Create
            </button>
          </form>
        </details>

        {visible.length === 0 ? (
          <section className={card}>
            <p className="py-6 text-center text-sm text-stone-400">
              No key-dates templates {groupParam && groupParam !== "all" ? "in this group" : "yet"}.
            </p>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((t) => (
              <section key={t.id} className={card}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    {t.description && <p className="text-sm text-stone-500">{t.description}</p>}
                  </div>
                  <DangerDelete
                    compact
                    action={deleteDateTemplate}
                    label="Delete"
                    description={`Removes "${t.name}" and its ${t.items.length} date${t.items.length === 1 ? "" : "s"}.`}
                    hidden={{ id: t.id }}
                  />
                </div>
                {t.items.length > 0 && (
                  <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                    {t.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 py-1.5 text-sm"
                      >
                        <span>
                          <span className="font-medium">{item.label}</span>
                          {item.anchor && (
                            <span className="text-stone-400">
                              {" "}
                              — {item.offsetDays ? `${Math.abs(item.offsetDays)} days ` : ""}
                              {item.offsetDays ? (item.offsetDays < 0 ? "before " : "after ") : ""}
                              {ANCHOR_LABEL[item.anchor] ?? item.anchor.toLowerCase()}
                            </span>
                          )}
                        </span>
                        <form action={deleteDateTemplateItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-400 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  action={addDateTemplateItem}
                  className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3"
                >
                  <input type="hidden" name="dateTemplateId" value={t.id} />
                  <label className={label}>
                    Date *
                    <input
                      name="label"
                      required
                      placeholder="Earnest money due"
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Transaction field *
                    <input
                      name="dateKey"
                      required
                      placeholder="earnestMoneyDueDate"
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Suggested from
                    <select name="anchor" className={input} defaultValue="">
                      <option value="">Manual entry</option>
                      {Object.values(DateAnchor).map((a) => (
                        <option key={a} value={a}>
                          {ANCHOR_LABEL[a] ?? a}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Offset (days)
                    <input name="offsetDays" type="number" placeholder="3" className={input} />
                  </label>
                  <button type="submit" className={btnGhost}>
                    Add date
                  </button>
                </form>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
