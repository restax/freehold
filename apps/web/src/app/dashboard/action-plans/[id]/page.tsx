import { DateAnchor, TaskPriority, withTenant } from "@freehold/db";
import { Check, TrashSimple } from "@phosphor-icons/react/dist/ssr";
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
import { btnGhost, card, input, label } from "@/lib/ui";

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

const fieldLabel = "flex flex-col gap-1 text-xs font-medium text-stone-500";
const compactInput = `${input} py-1.5`;

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
        {plan.tasks.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">
            No template tasks yet — add the first below.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col divide-y divide-stone-100">
            {plan.tasks.map((t) => (
              <li key={t.id} className="py-3 first:pt-0">
                <form action={updateTemplateTask} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="actionPlanId" value={plan.id} />
                  <span className="pb-2 w-5 shrink-0 text-center text-xs text-stone-400 tabular-nums">
                    {t.sortOrder}
                  </span>
                  <label className={`${fieldLabel} min-w-56 flex-1`}>
                    Task title
                    <input name="title" required defaultValue={t.title} className={compactInput} />
                  </label>
                  <label className={fieldLabel}>
                    Anchor
                    <select
                      name="anchor"
                      defaultValue={t.anchor}
                      className={`${compactInput} w-36`}
                    >
                      {Object.values(DateAnchor).map((a) => (
                        <option key={a} value={a}>
                          {ANCHOR_LABEL[a]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={fieldLabel}>
                    Offset (days)
                    <input
                      name="offsetDays"
                      type="number"
                      defaultValue={t.offsetDays}
                      className={`${compactInput} w-20`}
                    />
                  </label>
                  <label className={fieldLabel}>
                    Remind (days before)
                    <input
                      name="reminderDays"
                      type="number"
                      min={0}
                      placeholder="—"
                      defaultValue={t.reminderDays ?? ""}
                      className={`${compactInput} w-24`}
                    />
                  </label>
                  <label className={fieldLabel}>
                    Priority
                    <select
                      name="priority"
                      defaultValue={t.priority}
                      className={`${compactInput} w-28`}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={fieldLabel}>
                    Email template
                    <select
                      name="emailTemplateId"
                      defaultValue={t.emailTemplateId ?? ""}
                      className={`${compactInput} w-40`}
                    >
                      <option value="">None</option>
                      {emailTemplates.map((et) => (
                        <option key={et.id} value={et.id}>
                          {et.name.replace(" (Sample)", "")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      name="autoSendEmail"
                      defaultChecked={t.autoSendEmail}
                      className="accent-brand-600"
                    />
                    Auto-send
                  </label>
                  <button
                    type="submit"
                    title="Save changes"
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-500 shadow-xs transition hover:border-brand-600 hover:text-brand-700 active:scale-[0.98]"
                  >
                    <Check size={15} weight="bold" />
                  </button>
                </form>
                <form action={deleteTemplateTask} className="mt-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="actionPlanId" value={plan.id} />
                  <button
                    type="submit"
                    title="Delete task"
                    className="ml-7 flex items-center gap-1 text-xs text-stone-300 transition-colors hover:text-red-600"
                  >
                    <TrashSimple size={12} />
                    delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">Add task</p>
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
          <label className={label}>
            Remind (days before)
            <input name="reminderDays" type="number" min={0} placeholder="—" className={input} />
          </label>
          <label className={label}>
            Priority
            <select name="priority" className={input} defaultValue={TaskPriority.NORMAL}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Email template
            <select name="emailTemplateId" className={input} defaultValue="">
              <option value="">None</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name.replace(" (Sample)", "")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-700">
            <input type="checkbox" name="autoSendEmail" className="accent-brand-600" />
            Auto-send on completion
          </label>
          <button type="submit" className={btnGhost}>
            Add template task
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-400">
          Negative offsets fall before the anchor: “Close date, −1” is the day before closing. Tasks
          with an email template open compose with that email ready. Edit any row inline and save;
          the reminder is how many days before the due date to flag the task.
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
