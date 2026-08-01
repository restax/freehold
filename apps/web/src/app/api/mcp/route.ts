import type { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "mcp-handler";
import { auth } from "@/lib/auth";
import { type McpContext, resolveMcpContext } from "@/lib/mcp-session";
import { type McpToolDef, READ_TOOLS, toolsFor } from "@/lib/mcp-tools";

/**
 * The Claude connector: a remote MCP server over Streamable HTTP.
 *
 * This is the URL a coordinator pastes into Claude's "Add custom connector"
 * box. Everything it can reach is scoped to the one workspace they approved
 * on the consent screen, and to what their membership allows *right now* —
 * see lib/mcp-session.ts, which re-derives both on every call.
 */

export const dynamic = "force-dynamic";
// Claude gives a tool call up to 5 minutes. Our tools are database reads that
// finish in milliseconds; this ceiling only exists so a pathological query
// fails as a timeout rather than hanging the caller's whole turn.
export const maxDuration = 60;

const ALL_TOOLS: McpToolDef[] = [...READ_TOOLS];

/**
 * The 401 that starts the OAuth dance.
 *
 * The `resource_metadata` pointer is the whole point of this response: it is
 * how a client discovers which authorization server guards us. Anthropic
 * ignores a WWW-Authenticate header on a 200, so the status has to be 401 —
 * and without the pointer, clients fall back to probing well-known paths,
 * which is slower and quieter when it fails.
 */
function unauthenticated() {
  const root = (process.env.BETTER_AUTH_URL ?? "").replace(/\/+$/, "");
  const challenge = `Bearer resource_metadata="${root}/.well-known/oauth-protected-resource"`;
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Unauthorized: connect this workspace to Claude first." },
      id: null,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": challenge,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}

/**
 * Authenticated, but not allowed.
 *
 * Deliberately 403 rather than another 401: a 401 tells the client to go and
 * get a better token, which it cannot, so it would loop through consent
 * forever. A 403 surfaces as a plain error the person can act on — and the
 * message names the two switches that could be responsible, because "Claude
 * says it can't see my files" is otherwise an unanswerable support ticket.
 */
function forbidden() {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "No access to that workspace. The connector may be switched off for the workspace, or your access may have been changed. Check Settings, or ask the workspace owner.",
      },
      id: null,
    },
    { status: 403 },
  );
}

function register(server: McpServer, ctx: McpContext) {
  for (const tool of toolsFor(ctx, ALL_TOOLS)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        // Advertised so a client can warn before a write. Not a security
        // control — the real gate is that a write tool is never registered
        // for a connection without the write grant.
        annotations: { readOnlyHint: !tool.mutates },
      },
      async (args: Record<string, unknown>) => tool.run(ctx, args ?? {}),
    );
  }
}

async function handle(req: Request): Promise<Response> {
  // Step one: who is this? Better Auth verifies the bearer token against the
  // tokens it issued. It proves identity and nothing else.
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session?.userId) return unauthenticated();

  // Step two: which workspace, and what may they do in it — both re-derived,
  // never taken from the request.
  const ctx = await resolveMcpContext(session.userId, session.clientId);
  if (!ctx) return forbidden();

  // The server is built per request so the tool list reflects this caller's
  // capability. Registering every tool once and checking permission inside
  // each would leak the shape of what they cannot do.
  const handler = createMcpHandler((server) => register(server, ctx), {
    serverInfo: { name: "Freehold", version: "1" },
  });
  return handler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
