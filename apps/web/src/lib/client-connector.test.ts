import { describe, expect, it } from "vitest";
import {
  CLIENT_CONNECTOR_LEVEL_OPTIONS,
  type ClientConnectorLevel,
  clientConnectorCapability,
  clientConnectorLevelLabel,
  clientConnectorOffered,
  clientToolsFor,
  isClientConnectorLevel,
  matchOwnTransaction,
  NO_CLIENT_CONNECTOR_ACCESS,
  parseTaskAsk,
  REQUEST_NOTE_MAX,
  REQUEST_TITLE_MAX,
  sameConnectorEmail,
} from "./client-connector";

const ON = true;
const OFF = false;
const ALL_LEVELS: ClientConnectorLevel[] = ["NONE", "READ", "APPROVE", "FULL"];

describe("the workspace switch", () => {
  it("beats every per-client level", () => {
    // A subscriber who turns the client connector off should not also have to
    // walk their client list resetting levels one by one.
    for (const level of ALL_LEVELS) {
      expect(clientConnectorCapability(level, OFF), level).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
    }
  });

  it("says so plainly on the client page", () => {
    expect(clientConnectorLevelLabel("FULL", OFF)).toBe("Client connector off for this workspace");
  });

  it("offers nobody a connection while it is off", () => {
    for (const level of ALL_LEVELS) {
      expect(clientConnectorOffered(level, OFF), level).toBe(false);
    }
  });
});

describe("the default", () => {
  it("is no access, so a client gains nothing by merely existing", () => {
    expect(clientConnectorCapability("NONE", ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
    expect(clientConnectorCapability(null, ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
    expect(clientConnectorCapability(undefined, ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
  });

  it("is what an unrecognised level falls back to", () => {
    // A value this code doesn't know is a column written by something newer.
    // The safe reading of "newer than me" is no access, never a guess in the
    // client's favour.
    expect(clientConnectorCapability("SUPERUSER", ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
    expect(clientConnectorCapability("", ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
    expect(clientConnectorCapability("read", ON)).toEqual(NO_CLIENT_CONNECTOR_ACCESS);
  });
});

describe("the ladder", () => {
  it("gives read only its reads and nothing else", () => {
    expect(clientConnectorCapability("READ", ON)).toEqual({ read: true, writes: "none" });
  });

  it("lets the approval rung ask without changing anything", () => {
    // The distinction the whole feature turns on: at this level a client's
    // assistant records an ask, and no record moves until a coordinator says
    // so. If this ever returns "direct", the middle rung has silently become
    // the top one.
    expect(clientConnectorCapability("APPROVE", ON)).toEqual({ read: true, writes: "request" });
  });

  it("lets full access write directly", () => {
    expect(clientConnectorCapability("FULL", ON)).toEqual({ read: true, writes: "direct" });
  });

  it("never grants writes without reads", () => {
    // A tool surface that can change a file it cannot see would be incoherent,
    // and would mean a write path that skipped the scoping the reads enforce.
    for (const level of ALL_LEVELS) {
      const cap = clientConnectorCapability(level, ON);
      if (cap.writes !== "none") expect(cap.read, level).toBe(true);
    }
  });

  it("only ever widens as the level rises", () => {
    const rank = { none: 0, request: 1, direct: 2 } as const;
    const caps = ALL_LEVELS.map((l) => clientConnectorCapability(l, ON));
    for (let i = 1; i < caps.length; i++) {
      expect(rank[caps[i].writes] >= rank[caps[i - 1].writes], ALL_LEVELS[i]).toBe(true);
      expect(caps[i].read || !caps[i - 1].read, ALL_LEVELS[i]).toBe(true);
    }
  });
});

describe("the picker", () => {
  it("offers exactly the levels the resolver understands", () => {
    // A label with no matching branch would read as a granted level and
    // resolve to nothing — the kind of drift that looks like a broken feature
    // rather than a wrong setting.
    expect(CLIENT_CONNECTOR_LEVEL_OPTIONS.map(([value]) => value)).toEqual(ALL_LEVELS);
  });

  it("labels every level without jargon", () => {
    for (const [value, label] of CLIENT_CONNECTOR_LEVEL_OPTIONS) {
      expect(clientConnectorLevelLabel(value, ON)).toBe(label);
      expect(label).not.toMatch(/mcp|oauth|token|api/i);
    }
  });

  it("says what happens at the middle rung rather than naming a mode", () => {
    expect(clientConnectorLevelLabel("APPROVE", ON)).toBe("Changes need your approval");
  });
});

describe("whether to offer a connection at all", () => {
  it("tracks read access, so nobody is invited to something that resolves to nothing", () => {
    expect(clientConnectorOffered("NONE", ON)).toBe(false);
    expect(clientConnectorOffered("READ", ON)).toBe(true);
    expect(clientConnectorOffered("APPROVE", ON)).toBe(true);
    expect(clientConnectorOffered("FULL", ON)).toBe(true);
  });
});

describe("level validation", () => {
  it("accepts the stored levels and refuses everything else", () => {
    for (const level of ALL_LEVELS) expect(isClientConnectorLevel(level), level).toBe(true);
    for (const bad of ["none", "Read", "", "FULL ", null, undefined, 3, {}]) {
      expect(isClientConnectorLevel(bad), String(bad)).toBe(false);
    }
  });
});

describe("binding an address to a client record", () => {
  it("matches regardless of case or surrounding space", () => {
    expect(sameConnectorEmail("Jane@Brokerage.com", "jane@brokerage.com")).toBe(true);
    expect(sameConnectorEmail("  jane@brokerage.com  ", "jane@brokerage.com")).toBe(true);
  });

  it("refuses two different addresses", () => {
    expect(sameConnectorEmail("jane@brokerage.com", "john@brokerage.com")).toBe(false);
  });

  it("never matches when either side is missing, so clearing the field revokes", () => {
    expect(sameConnectorEmail("jane@brokerage.com", null)).toBe(false);
    expect(sameConnectorEmail(null, "jane@brokerage.com")).toBe(false);
    expect(sameConnectorEmail(null, null)).toBe(false);
    expect(sameConnectorEmail(undefined, undefined)).toBe(false);
  });

  it("treats blank and whitespace-only as missing rather than as agreement", () => {
    expect(sameConnectorEmail("", "")).toBe(false);
    expect(sameConnectorEmail("   ", "   ")).toBe(false);
    expect(sameConnectorEmail("   ", "jane@brokerage.com")).toBe(false);
  });
});

describe("which tools a connection is handed", () => {
  const READ = { name: "my_transactions", requires: "read" as const };
  const ASK = { name: "ask_for_a_task", requires: "request" as const };
  const DO = { name: "add_a_task", requires: "direct" as const };
  const EITHER = { name: "ask_to_start_a_file", requires: "write" as const };
  const ALL = [READ, ASK, DO, EITHER];
  const named = (level: ClientConnectorLevel, on = ON) =>
    clientToolsFor(clientConnectorCapability(level, on), ALL).map((t) => t.name);

  it("registers nothing at all at no access", () => {
    expect(named("NONE")).toEqual([]);
  });

  it("registers only the read tools at read-only", () => {
    expect(named("READ")).toEqual(["my_transactions"]);
  });

  it("gives the asking tool, and never the doing tool, when changes need approval", () => {
    // The middle rung's whole point: the assistant may ask, and asking is a
    // different tool from doing.
    expect(named("APPROVE")).toEqual(["my_transactions", "ask_for_a_task", "ask_to_start_a_file"]);
  });

  it("gives the doing tool, and never the asking tool, at full access", () => {
    // Not both: the coordinator already chose, so the assistant shouldn't
    // have to pick between asking and doing.
    expect(named("FULL")).toEqual(["my_transactions", "add_a_task", "ask_to_start_a_file"]);
  });

  it("keeps starting a new file an ask even at full access", () => {
    expect(named("FULL")).toContain("ask_to_start_a_file");
    expect(named("READ")).not.toContain("ask_to_start_a_file");
  });

  it("hands over nothing once the workspace switch is off, at every level", () => {
    for (const level of ALL_LEVELS) expect(named(level, OFF), level).toEqual([]);
  });
});

describe("what an outside assistant may write", () => {
  it("keeps a plain title and note", () => {
    const parsed = parseTaskAsk("Order the survey", "Seller's agent has the old one");
    expect(parsed).toEqual({
      ok: true,
      ask: { title: "Order the survey", note: "Seller's agent has the old one" },
    });
  });

  it("requires a title that is more than whitespace", () => {
    for (const bad of ["", "   ", null, undefined, 42, {}]) {
      expect(parseTaskAsk(bad, undefined).ok, String(bad)).toBe(false);
    }
  });

  it("caps both fields rather than silently truncating them", () => {
    expect(parseTaskAsk("x".repeat(REQUEST_TITLE_MAX), undefined).ok).toBe(true);
    expect(parseTaskAsk("x".repeat(REQUEST_TITLE_MAX + 1), undefined).ok).toBe(false);
    expect(parseTaskAsk("ok", "y".repeat(REQUEST_NOTE_MAX)).ok).toBe(true);
    expect(parseTaskAsk("ok", "y".repeat(REQUEST_NOTE_MAX + 1)).ok).toBe(false);
  });

  it("strips control characters but keeps the newlines a note may want", () => {
    const parsed = parseTaskAsk("Order\u0000 the survey", "one\ntwo");
    expect(parsed.ok && parsed.ask.title).toBe("Order the survey");
    expect(parsed.ok && parsed.ask.note).toBe("one\ntwo");
  });

  it("omits an empty note rather than storing a blank one", () => {
    const parsed = parseTaskAsk("Order the survey", "   ");
    expect(parsed.ok && parsed.ask).toEqual({ title: "Order the survey" });
  });
});

describe("resolving the file an assistant named", () => {
  const FILES = [
    { id: "t1", propertyAddress: "12 Oak Street" },
    { id: "t2", propertyAddress: "12 Oak Street Unit B" },
    { id: "t3", propertyAddress: "9 Elm Road" },
  ];

  it("matches one file on part of its address", () => {
    expect(matchOwnTransaction("elm", FILES)).toEqual({ kind: "one", txn: FILES[2] });
  });

  it("lets an exact address win over a longer one that contains it", () => {
    expect(matchOwnTransaction("12 Oak Street", FILES)).toEqual({ kind: "one", txn: FILES[0] });
  });

  it("reports ambiguity rather than guessing which file to write to", () => {
    const result = matchOwnTransaction("oak", FILES);
    expect(result.kind).toBe("many");
    expect(result.kind === "many" && result.options).toEqual([
      "12 Oak Street",
      "12 Oak Street Unit B",
    ]);
  });

  it("never matches an address the client does not have", () => {
    expect(matchOwnTransaction("500 Someone Else Lane", FILES)).toEqual({ kind: "none" });
    expect(matchOwnTransaction("", []).kind).toBe("none");
    expect(matchOwnTransaction(42, FILES)).toEqual({ kind: "none" });
  });

  it("takes the only open file when no address is given, and refuses to pick otherwise", () => {
    expect(matchOwnTransaction("", [FILES[0]])).toEqual({ kind: "one", txn: FILES[0] });
    expect(matchOwnTransaction("", FILES)).toEqual({ kind: "none" });
  });
});
