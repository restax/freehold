import { describe, expect, it } from "vitest";
import type { VoiceScope } from "./voice-grant";
import { briefForScope, toolsForScope } from "./voice-tools";

const TENANT: VoiceScope = { kind: "tenant", tenantId: "t1", userId: "u1" };
const GUEST: VoiceScope = { kind: "guest", tenantId: "t1", userId: "u2" };
const PORTAL: VoiceScope = { kind: "portal", portalToken: "tok" };

const names = (s: VoiceScope) =>
  toolsForScope(s)
    .map((t) => t.name)
    .sort();

const MARKETING: VoiceScope = { kind: "marketing" };

describe("toolsForScope", () => {
  it("gives the public marketing demo no tools at all", () => {
    // The homepage demo is open to the internet. It answers about Freehold
    // from a fixed brief and must have no route to anyone's data.
    expect(toolsForScope(MARKETING)).toEqual([]);
  });

  it("gives portal visitors only their own narrow tools", () => {
    expect(names(PORTAL)).toEqual(["my_dates", "my_documents", "my_files"]);
  });

  it("never exposes workspace-wide tools to a portal link", () => {
    // The load-bearing assertion: a portal grant must not be able to name a
    // tool that reads across the workspace.
    for (const wide of ["workspace_summary", "search_transactions", "find_people"]) {
      expect(names(PORTAL)).not.toContain(wide);
    }
  });

  it("gives signed-in workspace users the full set", () => {
    expect(names(TENANT)).toEqual([
      "find_people",
      "search_transactions",
      "upcoming_deadlines",
      "workspace_summary",
    ]);
  });

  it("hands guests the workspace toolset, which their queries then scope down", () => {
    // Guests share the catalogue but every query filters to assigned files —
    // see guestFilter in voice-tools.ts.
    expect(names(GUEST)).toEqual(names(TENANT));
  });

  it("publishes a valid schema for every tool", () => {
    for (const scope of [TENANT, PORTAL]) {
      for (const tool of toolsForScope(scope)) {
        expect(tool.name).toMatch(/^[a-z_]+$/);
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.input_schema.type).toBe("object");
      }
    }
  });
});

describe("briefForScope", () => {
  it("gives the marketing demo Freehold's own facts, not a data persona", () => {
    const brief = briefForScope(MARKETING);
    expect(brief.instructions).toContain("no access to any customer data");
    expect(brief.instructions).toContain("$40/month");
    expect(brief.greeting).toContain("ten-second");
  });

  it("tells workspace and portal scopes to always look data up", () => {
    for (const s of [TENANT, PORTAL]) {
      expect(briefForScope(s).instructions.toLowerCase()).toContain("never guess");
    }
  });

  it("never leaks workspace phrasing into the portal persona", () => {
    expect(briefForScope(PORTAL).instructions).toContain("only see this one");
  });
});
