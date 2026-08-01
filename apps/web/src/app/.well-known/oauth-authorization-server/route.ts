import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

/**
 * RFC 8414 authorization server metadata.
 *
 * Better Auth's mcp plugin already serves this under /api/auth/.well-known/,
 * but clients discover it by convention at the site root, and the ones that
 * do won't fall back. Serving it in both places is a few lines against a
 * failure mode that shows up only as "Couldn't reach the MCP server" with
 * nothing in our logs — the authorization server never sees a request at all.
 *
 * Anthropic reaches this from 160.79.104.0/21, so anything we ever put in
 * front of the site has to let that range through to here as well as to the
 * connector itself.
 */
export const dynamic = "force-dynamic";

export const GET = oAuthDiscoveryMetadata(auth);
