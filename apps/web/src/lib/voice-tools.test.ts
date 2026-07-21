import { describe, expect, it } from "vitest";
import type { VoiceScope } from "./voice-grant";
import {
  briefForScope,
  MARKETING_GREETING,
  marketingInstructions,
  toolsForScope,
} from "./voice-tools";

const TENANT: VoiceScope = { kind: "tenant", tenantId: "t1", userId: "u1" };
const GUEST: VoiceScope = { kind: "guest", tenantId: "t1", userId: "u2" };
const PORTAL: VoiceScope = { kind: "portal", portalToken: "tok" };

// toolsForScope/briefForScope now read platform_setting for the marketing
// scope (the founder-call kill switch), so only the DB-free scopes are
// covered here — the marketing behavior (0 tools off, 1 tool on) is verified
// against a real database the same way the rest of the vendor-order RLS work
// this session was: a standalone script, not vitest. marketingInstructions
// itself is pure and DB-free, so its content logic is fully covered below.
const names = async (s: VoiceScope) => (await toolsForScope(s)).map((t) => t.name).sort();

describe("toolsForScope", () => {
  it("gives portal visitors only their own narrow tools", async () => {
    expect(await names(PORTAL)).toEqual(["my_dates", "my_documents", "my_files"]);
  });

  it("never exposes workspace-wide tools to a portal link", async () => {
    // The load-bearing assertion: a portal grant must not be able to name a
    // tool that reads across the workspace.
    const portalNames = await names(PORTAL);
    for (const wide of ["workspace_summary", "search_transactions", "find_people"]) {
      expect(portalNames).not.toContain(wide);
    }
  });

  it("gives signed-in workspace users the full set", async () => {
    expect(await names(TENANT)).toEqual([
      "find_people",
      "search_transactions",
      "upcoming_deadlines",
      "workspace_summary",
    ]);
  });

  it("hands guests the workspace toolset, which their queries then scope down", async () => {
    // Guests share the catalogue but every query filters to assigned files —
    // see guestFilter in voice-tools.ts.
    expect(await names(GUEST)).toEqual(await names(TENANT));
  });

  it("publishes a valid schema for every tool", async () => {
    for (const scope of [TENANT, PORTAL]) {
      for (const tool of await toolsForScope(scope)) {
        expect(tool.name).toMatch(/^[a-z_]+$/);
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.input_schema.type).toBe("object");
      }
    }
  });
});

describe("briefForScope", () => {
  it("tells workspace and portal scopes to always look data up", async () => {
    for (const s of [TENANT, PORTAL]) {
      expect((await briefForScope(s)).instructions.toLowerCase()).toContain("never guess");
    }
  });

  it("never leaks workspace phrasing into the portal persona", async () => {
    expect((await briefForScope(PORTAL)).instructions).toContain("only see this one");
  });

  it("gives the marketing greeting a warm, short pitch instruction", () => {
    expect(MARKETING_GREETING).toContain("ten-second");
  });
});

describe("marketingInstructions", () => {
  const base = { sellingPoints: null, callAvailable: false };

  it("gives the marketing demo Freehold's own facts, not a data persona", () => {
    const text = marketingInstructions(base);
    expect(text).toContain("no access to any customer data");
    expect(text).toContain("$40/month");
  });

  it("says nothing about calling the founder when the kill switch is off", () => {
    const text = marketingInstructions(base);
    expect(text).not.toContain("call_the_founder");
  });

  it("instructs the offer only when the kill switch is on", () => {
    const text = marketingInstructions({ ...base, callAvailable: true });
    expect(text).toContain("call_the_founder");
    expect(text.toLowerCase()).toContain("once");
  });

  it("weaves in admin-provided selling points only when present", () => {
    const withPoints = marketingInstructions({ ...base, sellingPoints: "Talk about the vault." });
    expect(withPoints).toContain("Talk about the vault.");

    const withoutPoints = marketingInstructions({ ...base, sellingPoints: "  " });
    expect(withoutPoints).not.toContain("Key things to weave in");
  });
});
