import { DateAnchor, TaskPriority, withTenant } from "@freehold/db";
import { Check, Plus, TrashSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DangerDelete } from "@/components/danger-delete";
import {
  addTemplateDocument,
  addTemplateTask,
  deletePlan,
  deleteTemplateDocument,
  deleteTemplateTask,
  updateTemplateTask,
} from "@/lib/actions/action-plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btnGhost, card, input, label, th } from "@/lib/ui";

export const dynamic = "force-dynamic";

const ANCHOR_LABEL: Record<string, string> = {
  CONTRACT_DATE: "Contract date",
  CLOSE_DATE: "Close date",
};

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: TaskPriority.NORMAL, label: "Normal" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.CRITICAL, label: "Critical" },
];

/** Spreadsheet-style cell: invisible until hovered or focused, so the grid
 *  reads as data first and an editable field second. */
const cellInput =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm shadow-none transition-colors hover:border-stone-300 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600/20";
const cellTd = "border-b border-stone-100 p-0 align-middle";
const actionBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-stone-300 transition-colors hover:bg-stone-100 hover:text-stone-600";

export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;
  const { plan, emailTemplates } = await withTenant(tenantId, async (tx) => ({
    plan: await tx.actionPlan.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { sortOrder: "asc" } },
        documents: { orderBy: { sortOrder: "asc" } },
      },
    }),
    emailTemplates: await tx.emailTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  }));
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
        {isAdmin && (
          <DangerDelete
            compact
            action={deletePlan}
            label="Delete plan"
            description="Removes this checklist template (tasks already applied to transactions are kept)."
            hidden={{ id: plan.id }}
          />
        )}
      </div>

      <section className={card}>
        <div className="mb-2 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-8`}>#</th>
                <th className={th}>Task</th>
                <th className={`${th} w-32`}>Anchor</th>
                <th className={`${th} w-20 text-center`}>Offset</th>
                <th className={`${th} w-24 text-center`}>Remind</th>
                <th className={`${th} w-28`}>Priority</th>
                <th className={`${th} w-44`}>Email template</th>
                <th className={`${th} w-16 text-center`}>Auto-send</th>
                <th className={`${th} w-16`} />
              </tr>
            </thead>
            <tbody>
              {plan.tasks.map((t) => {
                const fid = `task-${t.id}`;
                return (
                  <tr key={t.id} className="group hover:bg-stone-50">
                    <td
                      className={`${cellTd} px-2 text-center text-xs text-stone-400 tabular-nums`}
                    >
                      {t.sortOrder}
                    </td>
                    <td className={cellTd}>
                      <input
                        form={fid}
                        name="title"
                        required
                        defaultValue={t.title}
                        className={cellInput}
                      />
                    </td>
                    <td className={cellTd}>
                      <select
                        form={fid}
                        name="anchor"
                        defaultValue={t.anchor}
                        className={cellInput}
                      >
                        {Object.values(DateAnchor).map((a) => (
                          <option key={a} value={a}>
                            {ANCHOR_LABEL[a]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellTd}>
                      <input
                        form={fid}
                        name="offsetDays"
                        type="number"
                        defaultValue={t.offsetDays}
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className={cellTd}>
                      <input
                        form={fid}
                        name="reminderDays"
                        type="number"
                        min={0}
                        placeholder="—"
                        defaultValue={t.reminderDays ?? ""}
                        className={`${cellInput} text-center`}
                      />
                    </td>
                    <td className={cellTd}>
                      <select
                        form={fid}
                        name="priority"
                        defaultValue={t.priority}
                        className={cellInput}
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellTd}>
                      <select
                        form={fid}
                        name="emailTemplateId"
                        defaultValue={t.emailTemplateId ?? ""}
                        className={cellInput}
                      >
                        <option value="">None</option>
                        {emailTemplates.map((et) => (
                          <option key={et.id} value={et.id}>
                            {et.name.replace(" (Sample)", "")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${cellTd} text-center`}>
                      <input
                        form={fid}
                        type="checkbox"
                        name="autoSendEmail"
                        defaultChecked={t.autoSendEmail}
                        className="accent-brand-600"
                      />
                    </td>
                    <td className={cellTd}>
                      <div className="flex items-center justify-end gap-0.5 pr-1">
                        <form id={fid} action={updateTemplateTask} className="contents">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="actionPlanId" value={plan.id} />
                          <button type="submit" title="Save changes" className={actionBtn}>
                            <Check size={14} weight="bold" />
                          </button>
                        </form>
                        <form action={deleteTemplateTask} className="contents">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="actionPlanId" value={plan.id} />
                          <button
                            type="submit"
                            title="Delete task"
                            className={`${actionBtn} hover:bg-red-50 hover:text-red-600`}
                          >
                            <TrashSimple size={14} />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-stone-50/60">
                <td className={cellTd} />
                <td className={cellTd}>
                  <input
                    form="add-task"
                    name="title"
                    required
                    placeholder="Add a task…"
                    className={cellInput}
                  />
                </td>
                <td className={cellTd}>
                  <select
                    form="add-task"
                    name="anchor"
                    defaultValue={DateAnchor.CLOSE_DATE}
                    className={cellInput}
                  >
                    {Object.values(DateAnchor).map((a) => (
                      <option key={a} value={a}>
                        {ANCHOR_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cellTd}>
                  <input
                    form="add-task"
                    name="offsetDays"
                    type="number"
                    defaultValue={0}
                    className={`${cellInput} text-center`}
                  />
                </td>
                <td className={cellTd}>
                  <input
                    form="add-task"
                    name="reminderDays"
                    type="number"
                    min={0}
                    placeholder="—"
                    className={`${cellInput} text-center`}
                  />
                </td>
                <td className={cellTd}>
                  <select
                    form="add-task"
                    name="priority"
                    defaultValue={TaskPriority.NORMAL}
                    className={cellInput}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={cellTd}>
                  <select
                    form="add-task"
                    name="emailTemplateId"
                    defaultValue=""
                    className={cellInput}
                  >
                    <option value="">None</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name.replace(" (Sample)", "")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${cellTd} text-center`}>
                  <input
                    form="add-task"
                    type="checkbox"
                    name="autoSendEmail"
                    className="accent-brand-600"
                  />
                </td>
                <td className={cellTd}>
                  <div className="flex items-center justify-end pr-1">
                    <form id="add-task" action={addTemplateTask} className="contents">
                      <input type="hidden" name="actionPlanId" value={plan.id} />
                      <button type="submit" title="Add task" className={actionBtn}>
                        <Plus size={14} weight="bold" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-stone-400">
          Negative offsets fall before the anchor: “Close date, −1” is the day before closing. Tasks
          with an email template open compose with that email ready. Click any cell to edit, then
          save the row; the reminder is how many days before the due date to flag the task.
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Required documents</h2>
        <p className="mb-3 text-sm text-stone-500">
          The documents a file on this plan should collect. Applying the plan drops this checklist
          onto the transaction's Documents tab, each one marked received or missing.
        </p>
        {plan.documents.length === 0 ? (
          <p className="mb-3 text-sm text-stone-400">No required documents yet — add one below.</p>
        ) : (
          <ul className="mb-3 flex flex-col divide-y divide-stone-100">
            {plan.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span>{d.label}</span>
                <form action={deleteTemplateDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="actionPlanId" value={plan.id} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addTemplateDocument} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="actionPlanId" value={plan.id} />
          <label className={`${label} min-w-64 flex-1`}>
            Document
            <input
              name="label"
              required
              className={input}
              placeholder="Purchase & Sale Agreement"
            />
          </label>
          <button type="submit" className={btnGhost}>
            Add required document
          </button>
        </form>
      </section>
    </div>
  );
}
