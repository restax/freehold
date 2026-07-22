"use server";

import { TaskStatus, withTenant } from "@freehold/db";
import { instantiatePlan, type PlanTaskTemplate } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { fireTaskTemplateEmail } from "@/lib/auto-emails";
import { confirmed, dateOnly, str } from "@/lib/forms";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

function revalidateTaskViews(transactionId: string | null) {
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard");
}

export async function createTask(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const title = str(formData, "title");
  if (!title) return;
  const transactionId = str(formData, "transactionId") || null;
  await withTenant(tenantId, (tx) =>
    tx.task.create({
      data: {
        tenantId,
        transactionId,
        title,
        dueDate: dateOnly(formData, "dueDate"),
        assigneeId: userId,
      },
    }),
  );
  revalidateTaskViews(transactionId);
}

export async function toggleTask(formData: FormData) {
  // Working tasks is the point of covering a file, so guests may — but only
  // on the files they were actually assigned.
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const id = str(formData, "id");
  if (!id) return;
  const transactionId = str(formData, "transactionId") || null;
  if (transactionId && !(await guestMaySeeTransaction(tenantId, session.user.id, transactionId))) {
    return;
  }
  const completed = await withTenant(tenantId, async (tx) => {
    const task = await tx.task.findUniqueOrThrow({
      where: { id },
      select: { status: true, title: true, emailTemplateId: true, autoSendEmail: true },
    });
    const nowDone = task.status !== TaskStatus.DONE;
    await tx.task.update({
      where: { id },
      data: {
        status: nowDone ? TaskStatus.DONE : TaskStatus.OPEN,
        completedAt: nowDone ? new Date() : null,
      },
    });
    return nowDone ? task.title : null;
  });
  if (completed !== null && transactionId) {
    // Optional automation: the task's email, merged and sent to the client
    // (quiet hours respected via the outbox).
    fireTaskTemplateEmail(tenantId, transactionId, id, session.user);
  }
  if (completed !== null) {
    await emitWebhook(tenantId, "task.completed", { id, title: completed, transactionId });
  }
  revalidateTaskViews(transactionId);
}

export async function deleteTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  const transactionId = str(formData, "transactionId") || null;
  await withTenant(tenantId, (tx) => tx.task.delete({ where: { id } }));
  revalidateTaskViews(transactionId);
}

/** Instantiate an action plan's template tasks onto a transaction. */
export async function applyActionPlan(formData: FormData) {
  const { tenantId, userId } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const planId = str(formData, "planId");
  if (!transactionId || !planId) return;

  await withTenant(tenantId, async (tx) => {
    const [txn, plan, maxSort] = await Promise.all([
      tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
        select: { contractDate: true, closeDate: true },
      }),
      tx.actionPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { tasks: true, documents: true },
      }),
      tx.task.aggregate({
        where: { transactionId },
        _max: { sortOrder: true },
      }),
    ]);

    // instantiatePlan sorts by sortOrder internally; sort our copy the same
    // way so tasks[i] and sortedPlanTasks[i] stay aligned.
    const sortedPlanTasks = [...plan.tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const sortedTemplates: PlanTaskTemplate[] = sortedPlanTasks.map((t) => ({
      title: t.title,
      anchor: t.anchor,
      offsetDays: t.offsetDays,
      sortOrder: t.sortOrder,
      assigneeRole: t.assigneeRole,
    }));
    const base = (maxSort._max.sortOrder ?? 0) + 1;
    const tasks = instantiatePlan(sortedTemplates, {
      contractDate: txn.contractDate,
      closeDate: txn.closeDate,
    });

    await tx.task.createMany({
      data: tasks.map((t, i) => ({
        tenantId,
        transactionId,
        title: t.title,
        dueDate: t.dueDate,
        // Provenance for domino recomputation on confirmed date changes.
        anchor: sortedTemplates[i]?.anchor ?? null,
        offsetDays: sortedTemplates[i]?.offsetDays ?? null,
        emailTemplateId: sortedPlanTasks[i]?.emailTemplateId ?? null,
        autoSendEmail: sortedPlanTasks[i]?.autoSendEmail ?? false,
        priority: sortedPlanTasks[i]?.priority ?? "NORMAL",
        sortOrder: base + i,
        // Role-based auto-assignment lands with multi-user teams; for now the
        // applying user owns every instantiated task.
        assigneeId: userId,
      })),
    });

    // Seed the required-documents checklist from the plan, skipping labels the
    // file already lists (applying twice, or overlapping plans, shouldn't
    // duplicate a slot).
    if (plan.documents.length > 0) {
      const existing = await tx.transactionRequiredDocument.findMany({
        where: { transactionId },
        select: { label: true, sortOrder: true },
      });
      const seen = new Set(existing.map((d) => d.label.toLowerCase()));
      const docBase = Math.max(0, ...existing.map((d) => d.sortOrder)) + 1;
      const toAdd = [...plan.documents]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((d) => !seen.has(d.label.toLowerCase()));
      if (toAdd.length > 0) {
        await tx.transactionRequiredDocument.createMany({
          data: toAdd.map((d, i) => ({
            tenantId,
            transactionId,
            label: d.label,
            sortOrder: docBase + i,
          })),
        });
      }
    }
  });
  revalidateTaskViews(transactionId);
}

const PRIORITY_CYCLE = ["NORMAL", "HIGH", "CRITICAL"] as const;

/** Cycle a task's priority flag: Normal → High → Critical → Normal. */
export async function cycleTaskPriority(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const transactionId = str(formData, "transactionId") || null;
  await withTenant(tenantId, async (tx) => {
    const task = await tx.task.findUniqueOrThrow({ where: { id }, select: { priority: true } });
    const next =
      PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(task.priority) + 1) % PRIORITY_CYCLE.length];
    await tx.task.update({ where: { id }, data: { priority: next } });
  });
  revalidateTaskViews(transactionId);
}
