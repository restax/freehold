import { DateAnchor, withTenant } from "@freehold/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DangerDelete } from "@/components/danger-delete";
import { TemplateTree } from "@/components/template-tree";
import {
  addDateTemplateItem,
  createDateTemplate,
  deleteDateTemplate,
  deleteDateTemplateItem,
  updateDateTemplate,
} from "@/lib/actions/date-templates";
import { DATE_CALCULATORS } from "@/lib/date-calculators";
import { KEY_DATE_LABELS } from "@/lib/governed-dates";
import { btn, btnGhost, card, input, label } from "@/lib/ui";

const CALCULATOR_LABEL: Record<string, string> = {
  BUSINESS_DAYS: "business days",
  CALENDAR_NEXT_BUSINESS_DAY: "days, rolled to the next business day",
  CALENDAR_PREV_BUSINESS_DAY: "days, rolled to the previous business day",
};

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

/** How one date-template item's rule reads, e.g. "10 business days after contract date". */
function itemRuleText(item: {
  anchor: string | null;
  offsetDays: number | null;
  calculator: string | null;
}): string | null {
  if (!item.anchor) return null;
  const anchorLabel = ANCHOR_LABEL[item.anchor] ?? item.anchor.toLowerCase();
  if (!item.offsetDays) return `On ${anchorLabel}`;
  const n = Math.abs(item.offsetDays);
  const unit = CALCULATOR_LABEL[item.calculator ?? ""] ?? (n === 1 ? "day" : "days");
  const direction = item.offsetDays < 0 ? "before" : "after";
  return `${n} ${unit} ${direction} ${anchorLabel}`;
}

export async function TemplatesTabDates({
  tenantId,
  isAdmin,
  dateId,
  folderParam,
}: {
  tenantId: string;
  isAdmin: boolean;
  dateId?: string;
  folderParam?: string;
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

  const isNew = dateId === "new";
  const template = !isNew ? templates.find((t) => t.id === dateId) : undefined;
  const newGroupId = folderParam && folderParam !== "none" ? folderParam : "";
  const groupName = (id: string | null) =>
    id ? (groups.find((g) => g.id === id)?.name ?? "No folder") : "No folder";

  return (
    <div className="flex gap-6">
      <TemplateTree
        kind="DATE"
        tab="dates"
        idParam="dateId"
        label="Key-dates templates"
        newLabel="New key-dates template"
        items={templates.map((t) => ({ id: t.id, name: t.name, groupId: t.groupId }))}
        groups={groups}
        selectedId={isNew ? "new" : template?.id}
        selectedGroupId={isNew ? (folderParam ?? null) : (template?.groupId ?? null)}
      />

      <div className="min-w-0 flex-1">
        {!isNew && !template && (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 text-center text-sm text-stone-400">
            <p>Select a key-dates template on the left, or create a new one.</p>
          </div>
        )}

        {isNew && (
          <div className="flex flex-col gap-4">
            <Breadcrumbs
              items={[
                { label: "Templates", href: "/dashboard/templates?tab=dates" },
                { label: "Key dates", href: "/dashboard/templates?tab=dates" },
                { label: groupName(newGroupId || null) },
                { label: "New key-dates template" },
              ]}
            />
            <p className="text-sm text-stone-500">
              Named sets of key dates with a suggested calculator per date. Applying one proposes
              computed values on a transaction — you confirm or override every one.
            </p>
            <section className={card}>
              <form action={createDateTemplate} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="groupId" value={newGroupId} />
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
            </section>
          </div>
        )}

        {template && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Breadcrumbs
                items={[
                  { label: "Templates", href: "/dashboard/templates?tab=dates" },
                  { label: "Key dates", href: "/dashboard/templates?tab=dates" },
                  { label: groupName(template.groupId) },
                  { label: template.name },
                ]}
              />
              {isAdmin && (
                <DangerDelete
                  compact
                  action={deleteDateTemplate}
                  label="Delete"
                  description={`Removes "${template.name}" and its ${template.items.length} date${template.items.length === 1 ? "" : "s"}.`}
                  hidden={{ id: template.id }}
                />
              )}
            </div>

            <section className={card}>
              <form action={updateDateTemplate} className="mb-4 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={template.id} />
                <label className={label}>
                  Name
                  <input name="name" defaultValue={template.name} className={input} />
                </label>
                <label className={`${label} min-w-64 flex-1`}>
                  Description
                  <input
                    name="description"
                    defaultValue={template.description ?? ""}
                    className={input}
                  />
                </label>
                <label className={label}>
                  Folder
                  <select name="groupId" defaultValue={template.groupId ?? ""} className={input}>
                    <option value="">No folder</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={btnGhost}>
                  Save
                </button>
              </form>

              {template.items.length > 0 && (
                <ul className="mb-3 flex flex-col divide-y divide-stone-100">
                  {template.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span>
                        <span className="font-medium">{item.label}</span>
                        <span className="text-stone-400"> → {item.dateKey}</span>
                        {itemRuleText(item) && (
                          <span className="text-stone-400"> — {itemRuleText(item)}</span>
                        )}
                      </span>
                      <form action={deleteDateTemplateItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="text-xs text-stone-400 hover:text-red-700">
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
                <input type="hidden" name="dateTemplateId" value={template.id} />
                <label className={label}>
                  Date *
                  <input name="label" required placeholder="Earnest money due" className={input} />
                </label>
                <label className={label}>
                  Transaction field *
                  <select name="dateKey" required className={input} defaultValue="">
                    <option value="" disabled>
                      Choose a field…
                    </option>
                    {Object.entries(KEY_DATE_LABELS).map(([key, keyLabel]) => (
                      <option key={key} value={key}>
                        {keyLabel}
                      </option>
                    ))}
                  </select>
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
                <label className={label}>
                  Counted in
                  <select name="calculator" className={input} defaultValue="">
                    <option value="">Calendar days</option>
                    {DATE_CALCULATORS.map((c) => (
                      <option key={c} value={c}>
                        {CALCULATOR_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className={btnGhost}>
                  Add date
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
