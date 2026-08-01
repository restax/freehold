import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

/**
 * RFC 9728 protected resource metadata — the document that tells Claude which
 * authorization server guards the connector.
 *
 * The `resource` field it returns must equal the connector URL exactly as the
 * user typed it, which is why lib/mcp.ts pins it rather than letting the
 * plugin default to the bare origin.
 */
export const dynamic = "force-dynamic";

export const GET = oAuthProtectedResourceMetadata(auth);
