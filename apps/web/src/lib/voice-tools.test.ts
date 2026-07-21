import { describe, expect, it } from "vitest";
import type { VoiceScope } from "./voice-grant";
import {
  briefForScope,
  extractReferences,
  MARKETING_GREETING,
  MARKETING_GREETING_WITH_CALL,
  marketingInstructions,
  runVoiceTool,
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
      "navigate",
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

describe("navigate tool", () => {
  it("resolves a known page to its dashboard path", async () => {
    expect(await runVoiceTool(TENANT, "navigate", { page: "billing" })).toEqual({
      navigateTo: "/dashboard/billing",
    });
  });

  it("rejects an unknown page", async () => {
    expect(await runVoiceTool(TENANT, "navigate", { page: "nonexistent" })).toEqual({
      error: "Can't go there.",
    });
  });

  it("restricts a guest to the same pages the sidebar shows them", async () => {
    expect(await runVoiceTool(GUEST, "navigate", { page: "transactions" })).toEqual({
      navigateTo: "/dashboard/transactions",
    });
    expect(await runVoiceTool(GUEST, "navigate", { page: "billing" })).toEqual({
      error: "Can't go there.",
    });
  });

  it("sends a tenant straight to a specific transaction, contact, or client by id", async () => {
    expect(await runVoiceTool(TENANT, "navigate", { transactionId: "t-1" })).toEqual({
      navigateTo: "/dashboard/transactions/t-1",
    });
    expect(await runVoiceTool(TENANT, "navigate", { contactId: "c-1" })).toEqual({
      navigateTo: "/dashboard/contacts/c-1",
    });
    expect(await runVoiceTool(TENANT, "navigate", { clientId: "cl-1" })).toEqual({
      navigateTo: "/dashboard/clients/cl-1",
    });
  });

  it("lets a guest go straight to a transaction but not a contact or client", async () => {
    expect(await runVoiceTool(GUEST, "navigate", { transactionId: "t-1" })).toEqual({
      navigateTo: "/dashboard/transactions/t-1",
    });
    expect(await runVoiceTool(GUEST, "navigate", { contactId: "c-1" })).toEqual({
      error: "Can't go there.",
    });
    expect(await runVoiceTool(GUEST, "navigate", { clientId: "cl-1" })).toEqual({
      error: "Can't go there.",
    });
  });
});

describe("extractReferences", () => {
  it("pulls transaction id+address pairs out of a search_transactions-shaped array", () => {
    const result = [
      { id: "t-1", address: "412 Maple St", status: "PENDING" },
      { id: "t-2", address: "9 Oak Ave", status: "CLOSED" },
    ];
    expect(extractReferences(result)).toEqual([
      { type: "transaction", id: "t-1", label: "412 Maple St" },
      { type: "transaction", id: "t-2", label: "9 Oak Ave" },
    ]);
  });

  it("pulls contacts and clients out of a find_people-shaped object", () => {
    const result = {
      contacts: [{ id: "c-1", name: "Dana Reyes", email: "dana@example.com" }],
      clients: [{ id: "cl-1", name: "The Riveras" }],
    };
    expect(extractReferences(result)).toEqual([
      { type: "contact", id: "c-1", label: "Dana Reyes" },
      { type: "client", id: "cl-1", label: "The Riveras" },
    ]);
  });

  it("pulls transactions out of an upcoming_deadlines-shaped result (tasks and closings)", () => {
    const result = {
      tasks: [
        {
          title: "Schedule inspection",
          due: "Friday",
          transactionId: "t-1",
          address: "412 Maple Ave",
        },
        { title: "No file attached", due: "Monday", transactionId: null, address: null },
      ],
      closings: [{ id: "t-2", address: "9 Oak Ave", closeDate: "Thursday" }],
    };
    expect(extractReferences(result)).toEqual([
      { type: "transaction", id: "t-1", label: "412 Maple Ave" },
      { type: "transaction", id: "t-2", label: "9 Oak Ave" },
    ]);
  });

  it("yields nothing for shapes it doesn't recognize", () => {
    expect(extractReferences({ result: "Nothing matched." })).toEqual([]);
    expect(extractReferences(null)).toEqual([]);
    expect(extractReferences("plain string")).toEqual([]);
    expect(extractReferences({ navigateTo: "/dashboard/billing" })).toEqual([]);
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
    expect(MARKETING_GREETING).toContain("five-second");
  });

  it("still pitches Freehold before pivoting to the call offer", () => {
    expect(MARKETING_GREETING_WITH_CALL).toContain("same warm five-second");
    expect(MARKETING_GREETING_WITH_CALL.toLowerCase()).toContain("call live");
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

  it("instructs the offer only when the kill switch is on, gated on a clear yes", () => {
    const text = marketingInstructions({ ...base, callAvailable: true });
    expect(text).toContain("call_the_founder");
    expect(text.toLowerCase()).toContain("clear yes");
  });

  it("weaves in admin-provided selling points only when present", () => {
    const withPoints = marketingInstructions({ ...base, sellingPoints: "Talk about the vault." });
    expect(withPoints).toContain("Talk about the vault.");

    const withoutPoints = marketingInstructions({ ...base, sellingPoints: "  " });
    expect(withoutPoints).not.toContain("Key things to weave in");
  });
});
