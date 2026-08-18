import { withTenant } from "@freehold/db";
import { z } from "zod";
import { matchOwnTransaction, parseTaskAsk, REQUEST_NOTE_MAX } from "@/lib/client-connector";
import type { ClientConnectorContext } from "@/lib/client-connector-session";
import type { ClientToolDef } from "@/lib/client-connector-tools";
import { toolResult } from "@/lib/mcp-tools";
import { agentClientData } from "@/lib/portal";

/**
 * What an outside agent's Claude may *change*, and the two ways it can.
 *
 * The ladder the coordinator set decides which of these is registered, and
 * never both: at "changes need your approval" the assistant gets the asking
 * tool, at "full access" it gets the doing tool. Offering both would put the
 * choice back on the assistant after the coordinator already made it.
 *
 * Neither tool takes an id. They take an address, matched against the files
 * this connection already resolved — see `matchOwnTransaction` for why that
 * distinction is the whole security story of this surface. The worst a wrong
 * address can do is fail to match.
 *
 * Starting a new file is an ask at every level, including full access. A task
 * on an existing file is a coordinator's day; a new engagement is a decision.
 */

/** Where a request or task lands, resolved from the address the model named. */
type Target =
  | { ok: true; txn: { id: string; propertyAddress: string } }
  | { ok: false; error: ReturnType<typeof toolResult> };

async function resolveTarget(ctx: ClientConnectorContext, address: unknown): Promise<Target> {
  const data = await agentClientData(ctx.tenantId, ctx.clientId);
  if (!data) return { ok: false, error: toolResult({ error: "lookup_failed" }) };

  const open = data.transactions.filter((t) => t.status !== "CLOSED" && t.status !== "CANCELLED");
  const match = matchOwnTransaction(address, open);
  if (match.kind === "one") return { ok: true, txn: match.txn };
  if (match.kind === "many") {
    return {
      ok: false,
      error: toolResult({
        error: "several_files_match",
        message: "More than one of your files matches that. Say which one.",
        options: match.options,
      }),
    };
  }
  return {
    ok: false,
    error: toolResult({
      error: "no_matching_file",
      message: "No open file of yours matches that address.",
      your_files: open.map((t) => t.propertyAddress),
    }),
  };
}

const TASK_INPUT = z.object({
  title: z.string().describe("What needs doing, in a few words"),
  address: z
    .string()
    .optional()
    .describe("Which of your properties. Optional when you only have one open file."),
  note: z
    .string()
    .optional()
    .describe(`Any detail the coordinator needs, up to ${REQUEST_NOTE_MAX} characters`),
});

export const CLIENT_WRITE_TOOLS: ClientToolDef[] = [
  {
    name: "ask_for_a_task",
    title: "Ask your coordinator for something",
    description:
      "Send your coordinator a request on one of your files. This does NOT schedule anything — it puts the ask in front of them to approve or decline, and they may reply. Use it whenever the agent wants something done.",
    requires: "request",
    inputSchema: TASK_INPUT,
    run: async (ctx, args) => {
      const ask = parseTaskAsk(args.title, args.note);
      if (!ask.ok) return toolResult({ error: "invalid_request", message: ask.error });

      const target = await resolveTarget(ctx, args.address);
      if (!target.ok) return target.error;

      await withTenant(ctx.tenantId, (tx) =>
        tx.clientConnectorRequest.create({
          data: {
            tenantId: ctx.tenantId,
            clientId: ctx.clientId,
            connectionId: ctx.connectionId,
            kind: "TASK",
            payload: { title: ask.ask.title, note: ask.ask.note ?? null },
            transactionId: target.txn.id,
          },
        }),
      );

      return toolResult({
        ok: true,
        // Said plainly so the assistant does not report this back as done.
        result: `Sent to your coordinator for approval. Nothing is scheduled yet.`,
        about: target.txn.propertyAddress,
      });
    },
  },
  {
    name: "add_a_task",
    title: "Add a task to one of your files",
    description:
      "Put a task straight onto one of your files. It appears on your coordinator's list immediately, marked as coming from you. Use this for things you would otherwise email them to add.",
    requires: "direct",
    inputSchema: TASK_INPUT,
    run: async (ctx, args) => {
      const ask = parseTaskAsk(args.title, args.note);
      if (!ask.ok) return toolResult({ error: "invalid_request", message: ask.error });

      const target = await resolveTarget(ctx, args.address);
      if (!target.ok) return target.error;

      const task = await withTenant(ctx.tenantId, (tx) =>
        tx.task.create({
          data: {
            tenantId: ctx.tenantId,
            transactionId: target.txn.id,
            title: ask.ask.title,
            notes: ask.ask.note ?? null,
            // Provenance that survives an edit and can be queried — this is
            // how a coordinator finds what a connection put here, including
            // at revocation time.
            source: "client_connector",
            // Visible to the agent who asked for it: hiding someone's own
            // request from them would be a strange thing to do.
            visibleToAgent: true,
          },
          select: { id: true },
        }),
      );

      return toolResult({
        ok: true,
        result: "Added to your coordinator's list.",
        about: target.txn.propertyAddress,
        taskId: task.id,
      });
    },
  },
  {
    name: "ask_to_start_a_file",
    title: "Ask to start a new file",
    description:
      "Ask your coordinator to open a new transaction. Always a request, even if you have full access on your existing files — starting an engagement is their decision. Put the address and anything known so far in the note.",
    requires: "write",
    inputSchema: z.object({
      title: z.string().describe("The property address, or a short description"),
      note: z.string().optional().describe("Anything known so far: price, dates, the other side"),
    }),
    run: async (ctx, args) => {
      const ask = parseTaskAsk(args.title, args.note);
      if (!ask.ok) return toolResult({ error: "invalid_request", message: ask.error });

      await withTenant(ctx.tenantId, (tx) =>
        tx.clientConnectorRequest.create({
          data: {
            tenantId: ctx.tenantId,
            clientId: ctx.clientId,
            connectionId: ctx.connectionId,
            kind: "NEW_TRANSACTION",
            payload: { title: ask.ask.title, note: ask.ask.note ?? null },
          },
        }),
      );

      return toolResult({
        ok: true,
        result: "Sent to your coordinator. They'll open the file if they take it on.",
      });
    },
  },
];
