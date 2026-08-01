import { prisma, withTenant } from "@freehold/db";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { logAudit } from "@/lib/audit";
import type { McpContext } from "@/lib/mcp-session";
import { type McpToolDef, toolResult } from "@/lib/mcp-tools";
import { guestMaySeeTransaction } from "@/lib/tenant";
import { normalizeStatus } from "@/lib/transaction-status";

/**
 * The three things Claude may change.
 *
 * Kept deliberately narrow. Everything here is additive or trivially
 * reversible: a task can be closed, a note is append-only, a status can be
 * set back. Nothing deletes, nothing sends email, nothing touches money or a
 * client-facing surface — those are the actions where a confidently wrong
 * assistant does damage a coordinator cannot undo before a client notices.
 *
 * Every write is attributed twice: to the tenant audit log, and to the
 * transaction's own activity trail. "Who changed this" then has an answer
 * that is true rather than merely plausible.
 */

/** The person behind the token, for activity lines that read like a human wrote them. */
async function actorFor(ctx: McpContext) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, email: true },
  });
  return {
    id: ctx.userId,
    email: user?.email ?? null,
    // "via Claude" belongs in the name rather than the summary: the activity
    // feed shows names in full and truncates summaries at 300 characters.
    name: `${user?.name ?? "Someone"} (via Claude)`,
  };
}

/**
 * Confirm a transaction id belongs to this workspace before writing to it.
 *
 * Two distinct checks, both needed. RLS already stops a cross-tenant write,
 * but it fails as an opaque error rather than a clear one. The guest rule is
 * ours rather than the database's: someone covering specific files under an
 * engagement may only touch the files they were actually handed.
 */
async function usableTransaction(ctx: McpContext, transactionId: string) {
  const found = await withTenant(ctx.tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, propertyAddress: true, status: true },
    }),
  );
  if (!found) return null;
  if (!(await guestMaySeeTransaction(ctx.tenantId, ctx.userId, transactionId))) return null;
  return found;
}

const NOT_FOUND = {
  error: "No transaction with that id in this workspace. Use search_transactions to find it.",
};

export const WRITE_TOOLS: McpToolDef[] = [
  {
    name: "create_task",
    title: "Create a task",
    description:
      "Add a task to the workspace, optionally attached to a transaction. Call search_transactions first to get the transaction id. The task is created unassigned.",
    mutates: true,
    inputSchema: z.object({
      title: z.string().min(1).max(300).describe("What needs doing"),
      transactionId: z
        .string()
        .optional()
        .describe("Attach to this transaction; omit for a standalone task"),
      dueDate: z.string().optional().describe("Due date as YYYY-MM-DD"),
      priority: z.enum(["NORMAL", "HIGH", "CRITICAL"]).optional().describe("Defaults to NORMAL"),
    }),
    run: async (ctx, args) => {
      const title = String(args.title ?? "").slice(0, 300);
      if (!title) return toolResult({ error: "A title is required." });

      const transactionId = typeof args.transactionId === "string" ? args.transactionId : null;
      let address: string | null = null;
      if (transactionId) {
        const txn = await usableTransaction(ctx, transactionId);
        if (!txn) return toolResult(NOT_FOUND);
        address = txn.propertyAddress;
      }

      // An unparseable date becomes no date rather than an error: the task
      // itself is still worth creating, and a null due date is visible and
      // fixable where a silently wrong one is not.
      const parsed =
        typeof args.dueDate === "string" ? new Date(`${args.dueDate}T00:00:00Z`) : null;
      const dueDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

      const priority =
        args.priority === "HIGH" || args.priority === "CRITICAL"
          ? (args.priority as "HIGH" | "CRITICAL")
          : "NORMAL";

      const created = await withTenant(ctx.tenantId, (tx) =>
        tx.task.create({
          data: { tenantId: ctx.tenantId, title, transactionId, priority, dueDate },
          select: { id: true, title: true, dueDate: true },
        }),
      );

      const actor = await actorFor(ctx);
      logActivity({
        tenantId: ctx.tenantId,
        transactionId,
        actor,
        action: "task.created",
        summary: `Added task "${title}"`,
      });
      logAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorEmail: actor.email,
        action: "mcp.task_created",
        summary: `Claude created task "${title}"${address ? ` on ${address}` : ""}`,
        subjectType: "task",
        subjectId: created.id,
      });

      return toolResult({
        ok: true,
        task: {
          id: created.id,
          title: created.title,
          dueDate: created.dueDate ? created.dueDate.toISOString().slice(0, 10) : null,
          transactionId,
        },
      });
    },
  },
  {
    name: "add_transaction_note",
    title: "Add a note to a transaction",
    description:
      "Append a dated line to a transaction's internal notes. Notes are internal — clients never see them. Existing notes are never overwritten.",
    mutates: true,
    inputSchema: z.object({
      transactionId: z.string().min(1).describe("From search_transactions"),
      note: z.string().min(1).max(2000).describe("The line to append"),
    }),
    run: async (ctx, args) => {
      const transactionId = String(args.transactionId ?? "");
      const note = String(args.note ?? "").slice(0, 2000);
      if (!transactionId || !note) {
        return toolResult({ error: "Both transactionId and note are required." });
      }

      const txn = await usableTransaction(ctx, transactionId);
      if (!txn) return toolResult(NOT_FOUND);

      // Append, never replace. Read-modify-write inside one withTenant call so
      // the read is scoped identically to the write.
      const stamp = new Date().toISOString().slice(0, 10);
      await withTenant(ctx.tenantId, async (tx) => {
        const current = await tx.transaction.findUnique({
          where: { id: transactionId },
          select: { notes: true },
        });
        return tx.transaction.update({
          where: { id: transactionId },
          data: {
            notes: `${current?.notes ? `${current.notes}\n` : ""}[${stamp}] ${note} (via Claude)`,
          },
          select: { id: true },
        });
      });

      const actor = await actorFor(ctx);
      logActivity({
        tenantId: ctx.tenantId,
        transactionId,
        actor,
        action: "note.added",
        summary: `Added a note: ${note.slice(0, 120)}`,
      });
      logAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorEmail: actor.email,
        action: "mcp.note_added",
        summary: `Claude added a note on ${txn.propertyAddress}`,
        subjectType: "transaction",
        subjectId: transactionId,
      });

      return toolResult({ ok: true, transactionId, appended: `[${stamp}] ${note}` });
    },
  },
  {
    name: "update_transaction_status",
    title: "Update a transaction's status",
    description:
      "Move a transaction to a different status: DRAFT, COMING_SOON, ACTIVE, TMP_OFF_MARKET, UNDER_CONTRACT, PENDING, CLOSED, or CANCELLED.",
    mutates: true,
    inputSchema: z.object({
      transactionId: z.string().min(1).describe("From search_transactions"),
      status: z.string().min(1).describe("The new status"),
    }),
    run: async (ctx, args) => {
      const transactionId = String(args.transactionId ?? "");
      const status = normalizeStatus(args.status);
      if (!status) {
        return toolResult({
          error:
            "Unrecognised status. Use one of DRAFT, COMING_SOON, ACTIVE, TMP_OFF_MARKET, UNDER_CONTRACT, PENDING, CLOSED, CANCELLED.",
        });
      }

      const txn = await usableTransaction(ctx, transactionId);
      if (!txn) return toolResult(NOT_FOUND);

      // Saying "already ACTIVE" beats reporting a successful change that
      // changed nothing — the model would otherwise tell the user it did
      // something it didn't.
      if (txn.status === status) {
        return toolResult({ ok: true, unchanged: true, status, transactionId });
      }

      await withTenant(ctx.tenantId, (tx) =>
        tx.transaction.update({
          where: { id: transactionId },
          data: { status },
          select: { id: true },
        }),
      );

      const actor = await actorFor(ctx);
      logActivity({
        tenantId: ctx.tenantId,
        transactionId,
        actor,
        action: "transaction.status_changed",
        summary: `Status ${txn.status} to ${status}`,
      });
      logAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorEmail: actor.email,
        action: "mcp.status_changed",
        summary: `Claude moved ${txn.propertyAddress} from ${txn.status} to ${status}`,
        subjectType: "transaction",
        subjectId: transactionId,
      });

      return toolResult({ ok: true, transactionId, from: txn.status, to: status });
    },
  },
];
