"use server";

import { TaskStatus, withTenant } from "@freehold/db";
import { instantiatePlan, type PlanTaskTemplate } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { dateOnly, str } from "@/lib/forms";
import { requireTenant } from "@/lib/tenant";
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
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
  const transactionId = str(formData, "transactionId") || null;
  const completed = await withTenant(tenantId, async (tx) => {
    const task = await tx.task.findUniqueOrThrow({
      where: { id },
      select: { status: true, title: true },
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
  if (completed !== null) {
    await emitWebhook(tenantId, "task.completed", { id, title: completed, transactionId });
  }
  revalidateTaskViews(transactionId);
}

export async function deleteTask(formData: FormData) {
  const { tenantId } = await requireTenant();
  const id = str(formData, "id");
  if (!id) return;
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
        include: { tasks: true },
      }),
      tx.task.aggregate({
        where: { transactionId },
        _max: { sortOrder: true },
      }),
    ]);

    const templates: PlanTaskTemplate[] = plan.tasks.map((t) => ({
      title: t.title,
      anchor: t.anchor,
      offsetDays: t.offsetDays,
      sortOrder: t.sortOrder,
      assigneeRole: t.assigneeRole,
    }));
    const base = (maxSort._max.sortOrder ?? 0) + 1;
    const tasks = instantiatePlan(templates, {
      contractDate: txn.contractDate,
      closeDate: txn.closeDate,
    });

    await tx.task.createMany({
      data: tasks.map((t, i) => ({
        tenantId,
        transactionId,
        title: t.title,
        dueDate: t.dueDate,
        sortOrder: base + i,
        // Role-based auto-assignment lands with multi-user teams; for now the
        // applying user owns every instantiated task.
        assigneeId: userId,
      })),
    });
  });
  revalidateTaskViews(transactionId);
}
