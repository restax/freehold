/**
 * Shared constants for the Claude connector (a remote MCP server).
 *
 * Deliberately dependency-free so the URL rules can be unit-tested: two of
 * them are exact-match requirements from Anthropic's connector spec, and
 * getting either subtly wrong fails as "Couldn't reach the MCP server" with
 * nothing in our own logs to explain it.
 */

/** Where the connector lives, relative to the site root. */
export const MCP_PATH = "/api/mcp";

/**
 * The connector's canonical URL — what a user types into Claude's "Add custom
 * connector" box, and what the protected-resource metadata's `resource` field
 * must equal *character for character*.
 *
 * Always the apex, never a tenant subdomain. A workspace is chosen after
 * sign-in, from the workspaces that person already belongs to, so there is
 * one connector URL for all of Freehold rather than one per tenant — which
 * also means one metadata document to keep correct instead of hundreds.
 */
export function mcpResourceUrl(baseUrl: string | undefined = process.env.BETTER_AUTH_URL): string {
  // Trailing slashes matter here: ".../api/mcp" and ".../api/mcp/" are
  // different strings to a spec-compliant client comparing `resource`.
  const root = (baseUrl ?? "").replace(/\/+$/, "");
  return `${root}${MCP_PATH}`;
}

/**
 * Redirect URIs the authorization server has to accept.
 *
 * The hosted Claude surfaces (web, Desktop, mobile, Cowork) all come back to
 * the one claude.ai callback. Claude Code is a native client and uses an
 * RFC 8252 loopback redirect on an ephemeral port, so its two entries must be
 * matched ignoring the port — see `loopbackRedirectAllowed`.
 */
export const CLAUDE_CALLBACK_URL = "https://claude.ai/api/mcp/auth_callback";
export const CLAUDE_CODE_LOOPBACKS = ["http://localhost/callback", "http://127.0.0.1/callback"];

/**
 * Whether a redirect URI is one of Claude Code's loopback callbacks.
 *
 * RFC 8252 §7.3 requires the port to be ignored for the IP-literal form, and
 * Anthropic asks for the same port-agnostic match on `localhost` so Claude
 * Code works at all — it binds a fresh port every session, so an exact-string
 * comparison rejects every connection after the first.
 */
export function loopbackRedirectAllowed(redirectUri: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
  // Compare the path only; the port is the part that legitimately varies.
  return url.pathname === "/callback";
}

/**
 * Scopes the connector issues.
 *
 * `offline_access` is what earns a refresh token — without it Claude has to
 * send the user back through consent every hour, which reads as the connector
 * being broken. The three OIDC scopes identify the person; nothing here
 * grants workspace authority. That is resolved per tool call from the live
 * member row, so a token is only ever as powerful as its holder is *today*.
 */
export const MCP_SCOPES = ["openid", "profile", "email", "offline_access"];

/**
 * Claude truncates a tool result past roughly 150,000 characters on the
 * hosted surfaces. Truncation lands mid-JSON, so the model sees a malformed
 * result rather than a short one — we cut earlier, on a boundary we choose,
 * and say so.
 */
export const MCP_RESULT_LIMIT = 120_000;

/** Trim an oversized tool result to something Claude can still parse. */
export function capResult(text: string, limit = MCP_RESULT_LIMIT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[Truncated: the full result was ${text.length.toLocaleString()} characters. Narrow the search and try again.]`;
}
