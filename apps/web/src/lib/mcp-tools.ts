import { z } from "zod";
import { capResult } from "@/lib/mcp";
import type { McpContext } from "@/lib/mcp-session";
import { runVoiceTool } from "@/lib/voice-tools";

/**
 * The connector's tool surface.
 *
 * Read tools are the same four the voice assistant already publishes, routed
 * through the same `runVoiceTool` dispatcher. That is deliberate: those
 * queries are already tenant-scoped, already respect the guest restriction,
 * and already have tests. A second implementation of "search this
 * workspace's transactions" is a second place for an authorisation bug to
 * live.
 *
 * The voice assistant's `navigate` tool is *not* exposed. It exists to move a
 * browser the user is looking at; Claude has no such browser, and a tool that
 * silently does nothing is worse than one that isn't offered.
 */

/** Shape every tool returns: JSON in a text block, capped so Claude can parse it. */
export function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: capResult(JSON.stringify(value, null, 2)) }],
  };
}

/** Run one of the shared voice tools under this connection's tenant scope. */
async function viaVoiceTool(ctx: McpContext, name: string, input: Record<string, unknown>) {
  // The scope is rebuilt from the resolved context on every call rather than
  // held anywhere, so it can never outlive the capability check that produced
  // it.
  const result = await runVoiceTool(
    { kind: "tenant", tenantId: ctx.tenantId, userId: ctx.userId },
    name,
    input,
  );
  return toolResult(result);
}

export interface McpToolDef {
  name: string;
  title: string;
  description: string;
  /** Whether this tool changes anything; write tools need the write grant. */
  mutates: boolean;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  run: (ctx: McpContext, args: Record<string, unknown>) => Promise<ReturnType<typeof toolResult>>;
}

export const READ_TOOLS: McpToolDef[] = [
  {
    name: "workspace_summary",
    title: "Workspace summary",
    description:
      "Counts across the whole workspace: active and closed transactions, clients, contacts, and open tasks. Use this for 'how many' or 'how's business' questions.",
    mutates: false,
    inputSchema: z.object({}),
    run: (ctx) => viaVoiceTool(ctx, "workspace_summary", {}),
  },
  {
    name: "search_transactions",
    title: "Search transactions",
    description:
      "Find transactions by property address or client name. Omit the query to list the most recent. Returns each transaction's id, which other tools take.",
    mutates: false,
    inputSchema: z.object({
      query: z.string().optional().describe("Address or client name; matches on part of either"),
      status: z
        .string()
        .optional()
        .describe(
          "Filter to one status: DRAFT, COMING_SOON, ACTIVE, TMP_OFF_MARKET, UNDER_CONTRACT, PENDING, CLOSED, or CANCELLED",
        ),
    }),
    run: (ctx, args) => viaVoiceTool(ctx, "search_transactions", args),
  },
  {
    name: "upcoming_deadlines",
    title: "Upcoming deadlines",
    description:
      "Open tasks and closings due in the next N days (7 by default). Use this for 'what's due', 'what's closing', or 'what's coming up'.",
    mutates: false,
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).optional().describe("How many days ahead; default 7"),
    }),
    run: (ctx, args) => viaVoiceTool(ctx, "upcoming_deadlines", args),
  },
  {
    name: "find_people",
    title: "Find people",
    description:
      "Search contacts and clients by name, email, or phone. Use this for 'what's so-and-so's number' or 'who is the lender on this file'.",
    mutates: false,
    inputSchema: z.object({
      query: z.string().min(1).describe("Name, email, or phone fragment"),
    }),
    run: (ctx, args) => viaVoiceTool(ctx, "find_people", args),
  },
];

/**
 * The tools a given connection may see.
 *
 * Filtering the *list*, not just the execution, matters: a tool Claude can
 * see is a tool it will try, and an assistant that repeatedly offers to do
 * something and then fails reads as broken software rather than as a
 * permission boundary. Someone with read-only access simply never learns the
 * write tools exist.
 */
export function toolsFor(ctx: McpContext, all: McpToolDef[]): McpToolDef[] {
  return all.filter((tool) => (tool.mutates ? ctx.capability.write : ctx.capability.read));
}
