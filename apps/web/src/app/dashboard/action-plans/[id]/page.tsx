import { withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionPlanDependencyTree } from "@/components/action-plan-dependency-tree";
import { ActionPlanTaskGrid } from "@/components/action-plan-task-grid";
import { DangerDelete } from "@/components/danger-delete";
import { SectionCard } from "@/components/section-card";
import {
  addTemplateDocument,
  deletePlan,
  deleteTemplateDocument,
} from "@/lib/actions/action-plans";
import { requireAdminTenant } from "@/lib/tenant";
import { btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ActionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId, isAdmin } = await requireAdminTenant();
  const { id } = await params;
  const [plan, emailTemplates, attachmentTemplates, dateTemplates, docTemplates] = await withTenant(
    tenantId,
    (tx) =>
      Promise.all([
        tx.actionPlan.findUnique({
          where: { id },
          include: {
            tasks: { orderBy: { sortOrder: "asc" } },
            documents: { orderBy: { sortOrder: "asc" } },
          },
        }),
        tx.emailTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        tx.attachmentTemplate.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        tx.dateTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        tx.docTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ]),
  );
  if (!plan) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/templates?tab=tasks"
            className="text-sm text-stone-500 hover:underline"
          >
            ← Templates
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
        <ActionPlanTaskGrid
          planId={plan.id}
          tasks={plan.tasks}
          emailTemplates={emailTemplates}
          attachmentTemplates={attachmentTemplates}
          dateTemplates={dateTemplates}
          docTemplates={docTemplates}
        />
      </section>

      <SectionCard title="Dependency chains">
        <p className="mb-3 text-sm text-stone-500">
          Tasks that wait on another task finishing rather than on a date from the file. They land
          undated when the plan is applied, and get their due date the moment the task above them is
          completed.
        </p>
        <ActionPlanDependencyTree tasks={plan.tasks} />
      </SectionCard>

      <SectionCard title="Required documents">
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
      </SectionCard>
    </div>
  );
}
