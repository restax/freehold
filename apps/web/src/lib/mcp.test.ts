import { describe, expect, it } from "vitest";
import {
  CLAUDE_CALLBACK_URL,
  capResult,
  loopbackRedirectAllowed,
  MCP_RESULT_LIMIT,
  MCP_SCOPES,
  mcpResourceUrl,
} from "./mcp";

describe("the connector's resource URL", () => {
  // Anthropic compares this string to what the user typed, character for
  // character. Every case below is a way we could silently stop matching.
  it("is the apex plus the connector path", () => {
    expect(mcpResourceUrl("https://freeholdtc.dev")).toBe("https://freeholdtc.dev/api/mcp");
  });

  it("does not double the slash when the base URL has a trailing one", () => {
    expect(mcpResourceUrl("https://freeholdtc.dev/")).toBe("https://freeholdtc.dev/api/mcp");
    expect(mcpResourceUrl("https://freeholdtc.dev///")).toBe("https://freeholdtc.dev/api/mcp");
  });

  it("works for a self-hosted install on a port", () => {
    expect(mcpResourceUrl("http://localhost:3010")).toBe("http://localhost:3010/api/mcp");
  });

  it("never ends in a slash, which would be a different resource", () => {
    expect(mcpResourceUrl("https://freeholdtc.dev")).not.toMatch(/\/$/);
  });
});

describe("Claude Code's loopback redirect", () => {
  // Claude Code binds a fresh ephemeral port every session. RFC 8252 §7.3
  // requires the port to be ignored; an exact-string comparison would let
  // exactly one connection through and reject every one after it.
  it("accepts any port on both loopback spellings", () => {
    expect(loopbackRedirectAllowed("http://localhost:3118/callback")).toBe(true);
    expect(loopbackRedirectAllowed("http://127.0.0.1:51234/callback")).toBe(true);
    expect(loopbackRedirectAllowed("http://localhost/callback")).toBe(true);
  });

  it("rejects a different path on the loopback host", () => {
    expect(loopbackRedirectAllowed("http://localhost:3118/steal")).toBe(false);
    expect(loopbackRedirectAllowed("http://localhost:3118/callback/extra")).toBe(false);
  });

  it("rejects any host that is not actually loopback", () => {
    // The interesting one is the last: a hostname that merely *contains*
    // "localhost" is not loopback, and a prefix check would wave it through.
    expect(loopbackRedirectAllowed("http://evil.example/callback")).toBe(false);
    expect(loopbackRedirectAllowed("http://127.0.0.2/callback")).toBe(false);
    expect(loopbackRedirectAllowed("http://localhost.evil.example/callback")).toBe(false);
  });

  it("rejects https and non-URL junk", () => {
    // Loopback is exempted from the HTTPS requirement precisely because it
    // never leaves the machine; an https loopback is not the documented form.
    expect(loopbackRedirectAllowed("https://localhost:3118/callback")).toBe(false);
    expect(loopbackRedirectAllowed("not a url")).toBe(false);
    expect(loopbackRedirectAllowed("")).toBe(false);
  });
});

describe("the hosted callback", () => {
  it("is the exact URL Anthropic publishes", () => {
    // Hard-coded on purpose: a typo here fails at the very last hop of the
    // OAuth dance, which is the most confusing place for it to fail.
    expect(CLAUDE_CALLBACK_URL).toBe("https://claude.ai/api/mcp/auth_callback");
  });
});

describe("scopes", () => {
  it("requests offline_access, without which Claude re-prompts hourly", () => {
    expect(MCP_SCOPES).toContain("offline_access");
  });

  it("grants no workspace authority — that is resolved per call", () => {
    // If a scope ever appears here that reads like a permission ("write",
    // "admin"), the model has drifted: authority comes from the member row.
    for (const scope of MCP_SCOPES) {
      expect(scope, scope).toMatch(/^(openid|profile|email|offline_access)$/);
    }
  });
});

describe("capping an oversized result", () => {
  it("leaves anything within the limit untouched", () => {
    expect(capResult("short")).toBe("short");
    const exact = "x".repeat(MCP_RESULT_LIMIT);
    expect(capResult(exact)).toBe(exact);
  });

  it("cuts on our boundary rather than Claude's", () => {
    // Claude truncates around 150k with no notice, which lands mid-JSON and
    // hands the model something unparseable. Cutting earlier, and saying so,
    // means a bad answer instead of a broken one.
    const huge = "x".repeat(MCP_RESULT_LIMIT + 500);
    const capped = capResult(huge);
    expect(capped.length).toBeLessThan(huge.length);
    expect(capped).toContain("Truncated");
    expect(capped).toContain("Narrow the search");
  });

  it("stays under the hosted-surface limit even with the notice appended", () => {
    expect(capResult("x".repeat(MCP_RESULT_LIMIT * 2)).length).toBeLessThan(150_000);
  });
});
