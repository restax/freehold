import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

/**
 * The path-suffixed form of the protected-resource document.
 *
 * When a client has no `resource_metadata` pointer to follow, it probes
 * /.well-known/oauth-protected-resource/<the connector's path> *first* and
 * only then the bare path — so for our /api/mcp connector that is
 * /.well-known/oauth-protected-resource/api/mcp. We do send the pointer, so
 * this is a fallback; it exists because the alternative failure is silent and
 * this catch-all costs nothing. Same document either way.
 */
export const dynamic = "force-dynamic";

export const GET = oAuthProtectedResourceMetadata(auth);
