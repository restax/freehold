"use server";

import { TaskStatus, withTenant } from "@freehold/db";
import { instantiatePlan, type PlanTaskTemplate } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { activityTitle, logActivity } from "@/lib/activity";
import { resolveAssigneeRole } from "@/lib/assignee-roles";
import { fireTaskTemplateEmail } from "@/lib/auto-emails";
import { confirmed, dateOnly, str } from "@/lib/forms";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";
import { emitWebhook } from "@/lib/webhook-emit";

function revalidateTaskViews(transactionId: string | null) {
  if (transactionId) revalidatePath(`/dashboard/transactions/${transactionId}`);
  revalidatePath("/dashboard");
}

export async function createTask(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
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
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "task.created",
    summary: `Added task “${activityTitle(title)}”`,
  });
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
  const { title, nowDone } = await withTenant(tenantId, async (tx) => {
    const task = await tx.task.findUniqueOrThrow({
      where: { id },
      select: { status: true, title: true, emailTemplateId: true, autoSendEmail: true },
    });
    const done = task.status !== TaskStatus.DONE;
    await tx.task.update({
      where: { id },
      data: {
        status: done ? TaskStatus.DONE : TaskStatus.OPEN,
        completedAt: done ? new Date() : null,
      },
    });
    return { title: task.title, nowDone: done };
  });
  if (nowDone && transactionId) {
    // Optional automation: the task's email, merged and sent to the client
    // (quiet hours respected via the outbox).
    fireTaskTemplateEmail(tenantId, transactionId, id, session.user);
  }
  if (nowDone) {
    await emitWebhook(tenantId, "task.completed", { id, title, transactionId });
  }
  // Reopening is activity too — it means someone looked at the file.
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: nowDone ? "task.completed" : "task.reopened",
    summary: `${nowDone ? "Completed" : "Reopened"} task “${activityTitle(title)}”`,
  });
  revalidateTaskViews(transactionId);
}

export async function deleteTask(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const id = str(formData, "id");
  if (!id || !confirmed(formData)) return;
  const transactionId = str(formData, "transactionId") || null;
  const removed = await withTenant(tenantId, (tx) => tx.task.delete({ where: { id } }));
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "task.deleted",
    summary: `Deleted task “${activityTitle(removed.title)}”`,
  });
  revalidateTaskViews(transactionId);
}

/** Instantiate an action plan's template tasks onto a transaction. */
export async function applyActionPlan(formData: FormData) {
  const { tenantId, userId, session } = await requireTenant();
  const transactionId = str(formData, "transactionId");
  const planId = str(formData, "planId");
  if (!transactionId || !planId) return;

  const planName = await withTenant(tenantId, async (tx) => {
    const [txn, plan, maxSort, assignees] = await Promise.all([
      tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
        select: {
          side: true,
          contractDate: true,
          closeDate: true,
          listDate: true,
          expireDate: true,
          mortgageCommitmentDate: true,
          inspectionDeadlineDate: true,
          earnestMoneyDueDate: true,
        },
      }),
      tx.actionPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { tasks: true, documents: true },
      }),
      tx.task.aggregate({
        where: { transactionId },
        _max: { sortOrder: true },
      }),
      tx.transactionAssignee.findMany({
        where: { transactionId },
        select: { userId: true, slot: true },
      }),
    ]);

    // instantiatePlan sorts by sortOrder internally; sort our copy the same
    // way so tasks[i] and sortedPlanTasks[i] stay aligned. Entries scoped to
    // a side that doesn't match this file are dropped before instantiation —
    // a buy-side file never gets the seller's under-contract welcome email.
    const sortedPlanTasks = [...plan.tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((t) => t.sides.length === 0 || t.sides.includes(txn.side));
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
      listDate: txn.listDate,
      expireDate: txn.expireDate,
      mortgageCommitmentDate: txn.mortgageCommitmentDate,
      inspectionDeadlineDate: txn.inspectionDeadlineDate,
      earnestMoneyDueDate: txn.earnestMoneyDueDate,
      templateStart: new Date(),
    });

    await tx.task.createMany({
      data: tasks.map((t, i) => ({
        tenantId,
        transactionId,
        title: t.title,
        notes: sortedPlanTasks[i]?.notes ?? null,
        dueDate: t.dueDate,
        kind: sortedPlanTasks[i]?.kind ?? "TODO",
        milestone: sortedPlanTasks[i]?.milestone ?? false,
        onCalendar: sortedPlanTasks[i]?.onCalendar ?? true,
        visibleToAgent: sortedPlanTasks[i]?.visibleToAgent ?? true,
        visibleToClient: sortedPlanTasks[i]?.visibleToClient ?? true,
        // Provenance for domino recomputation on confirmed date changes.
        anchor: sortedTemplates[i]?.anchor ?? null,
        offsetDays: sortedTemplates[i]?.offsetDays ?? null,
        emailTemplateId: sortedPlanTasks[i]?.emailTemplateId ?? null,
        autoSendEmail: sortedPlanTasks[i]?.autoSendEmail ?? false,
        priority: sortedPlanTasks[i]?.priority ?? "NORMAL",
        sortOrder: base + i,
        // TC1/TC2 resolve to whoever holds that seat on this file; AGENT and
        // an unfilled seat both leave the task unassigned (see
        // resolveAssigneeRole) — the role still shows on the row. A template
        // entry with no role at all (the common case today) keeps the old
        // behavior of defaulting to whoever applied the plan.
        assigneeRole: sortedPlanTasks[i]?.assigneeRole ?? null,
        assigneeId: sortedPlanTasks[i]?.assigneeRole
          ? resolveAssigneeRole(sortedPlanTasks[i]?.assigneeRole, assignees)
          : userId,
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
    return plan.name;
  });
  logActivity({
    tenantId,
    transactionId,
    actor: session.user,
    action: "plan.applied",
    summary: `Applied action plan “${activityTitle(planName)}”`,
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
