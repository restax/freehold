import { withTenant } from "@freehold/db";
import { z } from "zod";
import type { ClientToolRequirement } from "@/lib/client-connector";
import type { ClientConnectorContext } from "@/lib/client-connector-session";
import { fmtDate } from "@/lib/format";
import { toolResult } from "@/lib/mcp-tools";
import { agentClientData } from "@/lib/portal";

/**
 * What an outside agent's own Claude may read.
 *
 * Every tool here answers about one client and takes no id at all. That is
 * the design, not an omission: a tool that accepted a transaction id would be
 * a tool the model could be talked into pointing somewhere else, and the
 * whole promise of this surface is that an agent sees their own files and
 * nothing belonging to anyone else their coordinator works with. The client
 * comes from the resolved connection, which the model never touches.
 *
 * The reads themselves go through `agentClientData`, the same function behind
 * the agent portal's own pages. So an answer here can never exceed what that
 * agent's portal already shows them, and there is one place to fix if it
 * ever shows too much.
 *
 * Deliberately smaller than the staff surface. A coordinator's connector can
 * search the workspace and look up people; there is no equivalent here,
 * because "search" over a set of one client's files is just "list them", and
 * a people-lookup would reach contacts belonging to the coordinator.
 */
export interface ClientToolDef {
  name: string;
  title: string;
  description: string;
  /** Which rung of the ladder this needs; the gate in client-connector.ts reads it. */
  requires: ClientToolRequirement;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  run: (
    ctx: ClientConnectorContext,
    args: Record<string, unknown>,
  ) => Promise<ReturnType<typeof toolResult>>;
}

/** Shared loader: one round trip, whichever tool asked. */
async function data(ctx: ClientConnectorContext) {
  return agentClientData(ctx.tenantId, ctx.clientId);
}

export const CLIENT_READ_TOOLS: ClientToolDef[] = [
  {
    name: "my_transactions",
    title: "My transactions",
    description:
      "Every transaction the coordinator is running for you: property address, status, side, price, and the contract and closing dates. Use this for 'what's open', 'where are we on X', or 'when does Y close'.",
    requires: "read",
    inputSchema: z.object({}),
    run: async (ctx) => {
      const d = await data(ctx);
      if (!d) return toolResult({ error: "lookup_failed" });
      if (d.transactions.length === 0) {
        return toolResult({ result: "No transactions on file with this coordinator yet." });
      }
      return toolResult(
        d.transactions.map((t) => ({
          address: t.propertyAddress,
          city: t.city,
          state: t.state,
          status: t.status,
          side: t.side,
          purchasePrice: t.purchasePrice,
          contractDate: fmtDate(t.contractDate),
          closeDate: fmtDate(t.closeDate),
        })),
      );
    },
  },
  {
    name: "my_deadlines",
    title: "My deadlines",
    description:
      "Dates coming up in the next 30 days across your files, soonest first, with the property each belongs to. Use this for 'what's due', 'what's next', or 'what am I waiting on'.",
    requires: "read",
    inputSchema: z.object({}),
    run: async (ctx) => {
      const d = await data(ctx);
      if (!d) return toolResult({ error: "lookup_failed" });
      if (d.upcoming.length === 0) {
        return toolResult({ result: "Nothing coming up in the next 30 days." });
      }
      return toolResult(
        d.upcoming.map((t) => ({
          milestone: t.title,
          date: fmtDate(t.dueDate),
          address: t.transaction?.propertyAddress ?? null,
        })),
      );
    },
  },
  {
    name: "my_recent_activity",
    title: "Recent activity",
    description:
      "What has moved on your files in the last week: tasks your coordinator completed, and documents they shared with you. Use this for 'what's happened', 'any news', or 'what did they do this week'.",
    requires: "read",
    inputSchema: z.object({}),
    run: async (ctx) => {
      const d = await data(ctx);
      if (!d) return toolResult({ error: "lookup_failed" });
      const completed = d.recentTasks.map((t) => ({
        kind: "completed" as const,
        what: t.title,
        when: fmtDate(t.completedAt),
        address: t.transaction?.propertyAddress ?? null,
      }));
      const shared = d.recentDocs.map((doc) => ({
        kind: "document" as const,
        // Names only, never contents — the same line the portal's own
        // document list holds.
        what: doc.filename,
        when: fmtDate(doc.createdAt),
        address: doc.transaction?.propertyAddress ?? null,
      }));
      const all = [...completed, ...shared];
      if (all.length === 0) return toolResult({ result: "Nothing new in the last week." });
      return toolResult(all);
    },
  },
  {
    name: "my_requests",
    title: "What I asked for",
    description:
      "The last few things you asked your coordinator for through here, and what they said. Use this before asking again, and to see whether something was approved, declined, or is still waiting.",
    requires: "read",
    inputSchema: z.object({}),
    run: async (ctx) => {
      // Closes the loop the other direction. Without this the coordinator's
      // reply is write-only: they answer "already scheduled for Tuesday" and
      // the agent never hears it, which is the phone call this was meant to
      // save.
      const rows = await withTenant(ctx.tenantId, (tx) =>
        tx.clientConnectorRequest.findMany({
          where: { tenantId: ctx.tenantId, clientId: ctx.clientId },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            kind: true,
            payload: true,
            status: true,
            resolutionNote: true,
            createdAt: true,
            reviewedAt: true,
            transaction: { select: { propertyAddress: true } },
          },
        }),
      );
      if (rows.length === 0) return toolResult({ result: "You haven't asked for anything yet." });
      return toolResult(
        rows.map((r) => {
          const ask = (r.payload ?? {}) as { title?: string };
          return {
            asked_for: ask.title ?? "(untitled)",
            about: r.transaction?.propertyAddress ?? null,
            kind: r.kind === "NEW_TRANSACTION" ? "a new file" : "a task",
            status:
              r.status === "NEW"
                ? "waiting on your coordinator"
                : r.status === "APPROVED"
                  ? "approved"
                  : "declined",
            they_said: r.resolutionNote,
            asked: fmtDate(r.createdAt),
            answered: fmtDate(r.reviewedAt),
          };
        }),
      );
    },
  },
];
