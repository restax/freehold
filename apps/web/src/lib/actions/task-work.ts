"use server";

import { withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { activityTitle, logActivity } from "@/lib/activity";
import { str } from "@/lib/forms";
import { listTenants } from "@/lib/session";
import { putObject } from "@/lib/storage";
import { buildMergeContext, renderTemplatePdf, resolveTemplate } from "@/lib/templates";
import { guestMaySeeTransaction, requireTenant } from "@/lib/tenant";

/**
 * Doing the work on a task, from the task's own screen.
 *
 * The checklist says a call needs making or a letter needs writing; these are
 * the actions that record it happening. Each one writes a task-scoped activity
 * row, so the task carries its own history while the file's activity feed
 * still shows everything in one place (see lib/activity.ts).
 *
 * Every write re-derives access server-side and refuses a guest on a file they
 * weren't handed — the task id in a form is never trusted on its own.
 */

const MAX_BYTES = 15 * 1024 * 1024;

/** Resolve a task the caller may actually work on, or null. */
async function taskForWrite(
  tenantId: string,
  userId: string,
  taskId: string,
  transactionId: string,
) {
  if (!taskId || !transactionId) return null;
  if (!(await guestMaySeeTransaction(tenantId, userId, transactionId))) return null;
  // Read under the tenant's own scope: a task id from another workspace
  // doesn't exist here, so a forged id is a miss rather than a leak.
  const task = await withTenant(tenantId, (tx) =>
    tx.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, transactionId: true },
    }),
  );
  if (!task || task.transactionId !== transactionId) return null;
  return task;
}

function revalidateTask(transactionId: string, taskId: string) {
  revalidatePath(`/dashboard/transactions/${transactionId}/tasks/${taskId}`);
  revalidatePath(`/dashboard/transactions/${transactionId}`);
}

/**
 * Log a call made about this task.
 *
 * Freehold doesn't place the call — the number is a tel: link on the screen,
 * which is what actually works across a desk phone, a mobile, and a softphone.
 * What matters afterwards is the record that it happened and what was said.
 */
export async function logTaskCall(formData: FormData) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const taskId = str(formData, "taskId");
  const transactionId = str(formData, "transactionId");
  const task = await taskForWrite(tenantId, session.user.id, taskId, transactionId);
  if (!task) return;

  const who = str(formData, "who");
  const outcome = str(formData, "outcome");
  const note = str(formData, "note");
  // A call with no detail at all is a mis-click, not a record worth keeping.
  if (!who && !note) return;

  const parts = [who && `Called ${who}`, outcome, note].filter(Boolean);
  logActivity({
    tenantId,
    transactionId,
    taskId,
    actor: session.user,
    action: "task.call",
    summary: parts.join(" — ").slice(0, 300),
  });
  revalidateTask(transactionId, taskId);
}

/** A free-text note on the task's work log, distinct from the task's own
 *  notes field: this is "what happened", that is "what to know". */
export async function addTaskNote(formData: FormData) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const taskId = str(formData, "taskId");
  const transactionId = str(formData, "transactionId");
  const task = await taskForWrite(tenantId, session.user.id, taskId, transactionId);
  if (!task) return;

  const note = str(formData, "note");
  if (!note) return;
  logActivity({
    tenantId,
    transactionId,
    taskId,
    actor: session.user,
    action: "task.note",
    summary: note.slice(0, 300),
  });
  revalidateTask(transactionId, taskId);
}

/**
 * Write a document for this task from a template.
 *
 * Same merge-and-render path as the Documents tab's generator, with the file
 * tagged to the task so the task's own screen can list what it produced.
 */
export async function generateTaskDocument(formData: FormData) {
  const { tenantId, session } = await requireTenant();
  const taskId = str(formData, "taskId");
  const transactionId = str(formData, "transactionId");
  const templateId = str(formData, "templateId");
  const task = await taskForWrite(tenantId, session.user.id, taskId, transactionId);
  if (!task || !templateId) return;

  const tenants = await listTenants();
  const tenantName = tenants.find((t) => t.id === tenantId)?.name ?? "";
  const { template, txn } = await withTenant(tenantId, async (tx) => ({
    template: await tx.docTemplate.findUnique({ where: { id: templateId } }),
    txn: await tx.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { client: true, parties: { include: { contact: true } } },
    }),
  }));
  if (!template) return;

  const ctx = buildMergeContext(txn, tenantName);
  const { text } = resolveTemplate(template.body, ctx);
  const pdf = await renderTemplatePdf(template.name, text);
  const filename = `${template.name.replace(/[^\w.\- ]/g, "_")}.pdf`;
  const stored = await putObject(tenantId, filename, pdf, "application/pdf");

  const doc = await withTenant(tenantId, (tx) =>
    tx.document.create({
      data: {
        tenantId,
        transactionId,
        taskId,
        filename,
        contentType: "application/pdf",
        sizeBytes: pdf.length,
        data: stored.data,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
      },
    }),
  );
  logActivity({
    tenantId,
    transactionId,
    taskId,
    documentId: doc.id,
    actor: session.user,
    action: "task.document",
    summary: `Wrote “${activityTitle(filename)}” for this task`,
  });
  revalidateTask(transactionId, taskId);
}

/** Upload a file against this task. Same limits as the Attachments tab. */
export async function uploadTaskDocument(formData: FormData) {
  const { tenantId, session } = await requireTenant({ allowGuest: true });
  const taskId = str(formData, "taskId");
  const transactionId = str(formData, "transactionId");
  const task = await taskForWrite(tenantId, session.user.id, taskId, transactionId);
  if (!task) return;

  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0 && f.size <= MAX_BYTES);
  if (files.length === 0) return;

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "document.pdf";
    const contentType = file.type || "application/octet-stream";
    const stored = await putObject(tenantId, filename, bytes, contentType);
    const doc = await withTenant(tenantId, (tx) =>
      tx.document.create({
        data: {
          tenantId,
          transactionId,
          taskId,
          filename,
          contentType,
          sizeBytes: bytes.length,
          data: stored.data,
          storageKey: stored.storageKey,
          storageProvider: stored.storageProvider,
        },
      }),
    );
    logActivity({
      tenantId,
      transactionId,
      taskId,
      documentId: doc.id,
      actor: session.user,
      action: "task.document",
      summary: `Attached “${activityTitle(filename)}” to this task`,
    });
  }
  revalidateTask(transactionId, taskId);
}
