/**
 * What one of the tenant's *clients* — an outside agent or brokerage — may do
 * through their own Claude.
 *
 * The sibling of lib/mcp-access.ts, and separate from it for the same reason
 * the tables are separate: that file answers "how much of this workspace does
 * a member get", this one answers "how much of their own corner of it does an
 * outsider get". Sharing a resolver would mean one edit could quietly move
 * the other audience's boundary.
 *
 * Two gates, and both must open: the subscriber's workspace switch, and the
 * level the coordinator set on that client. The switch is a parameter rather
 * than something callers check separately and sometimes forget to — the
 * pattern mcpCapability already uses, for the reason it uses it.
 *
 * Dependency-free on purpose, so the whole table is unit-testable. This is
 * the only place that decides, and it is called on *every* tool call rather
 * than once when a token is minted: that is what makes a coordinator dropping
 * a client from full access to read-only take effect on the client's next
 * message rather than whenever a refresh token happens to lapse.
 */

/** The stored levels, in the order they widen. */
export type ClientConnectorLevel = "NONE" | "READ" | "APPROVE" | "FULL";

export interface ClientConnectorCapability {
  /** Their own files, their own dates, their own documents. Never anyone else's. */
  read: boolean;
  /**
   * What happens when their assistant tries to change something.
   *
   * - `"none"`: no write tool is registered at all.
   * - `"request"`: the ask is recorded for the coordinator to approve. It
   *   changes no record, which is the entire point of the middle rung.
   * - `"direct"`: a task lands on their own file immediately, labelled.
   *
   * Three states rather than a boolean because "may ask" is a real answer,
   * and the one most coordinators want.
   */
  writes: "none" | "request" | "direct";
}

export const NO_CLIENT_CONNECTOR_ACCESS: ClientConnectorCapability = {
  read: false,
  writes: "none",
};

/**
 * The picker on the client's page. Wording per the project's table: no
 * jargon, and the middle rung says what happens rather than naming a mode.
 */
export const CLIENT_CONNECTOR_LEVEL_OPTIONS: Array<[ClientConnectorLevel, string]> = [
  ["NONE", "No access"],
  ["READ", "Read only"],
  ["APPROVE", "Changes need your approval"],
  ["FULL", "Full access"],
];

const LEVELS: ClientConnectorLevel[] = ["NONE", "READ", "APPROVE", "FULL"];

/** Whether a stored string is a level we recognise. Actions validate with this. */
export function isClientConnectorLevel(value: unknown): value is ClientConnectorLevel {
  return typeof value === "string" && (LEVELS as string[]).includes(value);
}

export function clientConnectorCapability(
  level: ClientConnectorLevel | string | null | undefined,
  workspaceEnabled: boolean,
): ClientConnectorCapability {
  // The subscriber's switch wins over every per-client grant, including one
  // set before the switch was ever turned on. Off means off — not "off unless
  // someone was already allowed", which is how a kill switch stops being one.
  if (!workspaceEnabled) return NO_CLIENT_CONNECTOR_ACCESS;

  switch (level) {
    case "READ":
      return { read: true, writes: "none" };
    case "APPROVE":
      return { read: true, writes: "request" };
    case "FULL":
      return { read: true, writes: "direct" };
    default:
      // NONE, null, and anything unrecognised. A level we can't read is not a
      // reason to guess generously: an unknown string here means a column
      // written by something newer than this code, and the safe reading of
      // "newer than me" is no access.
      return NO_CLIENT_CONNECTOR_ACCESS;
  }
}

/** What the client page shows for a client's current setting. */
export function clientConnectorLevelLabel(
  level: ClientConnectorLevel | string | null | undefined,
  workspaceEnabled: boolean,
): string {
  if (!workspaceEnabled) return "Client connector off for this workspace";
  const match = CLIENT_CONNECTOR_LEVEL_OPTIONS.find(([value]) => value === level);
  return match ? match[1] : "No access";
}

/**
 * Whether a client at this level should be offered a connection at all.
 *
 * Read on the client page and, later, on the agent portal: there is no point
 * showing someone an invite for something that would resolve to nothing.
 */
export function clientConnectorOffered(
  level: ClientConnectorLevel | string | null | undefined,
  workspaceEnabled: boolean,
): boolean {
  return clientConnectorCapability(level, workspaceEnabled).read;
}

/**
 * Whether two addresses name the same mailbox, for binding purposes.
 *
 * Case- and whitespace-insensitive, because nobody types their own address
 * the same way twice and a coordinator entering "Jane@" while the agent signs
 * up as "jane@" is a support ticket rather than a security boundary.
 *
 * A null or empty on either side is never a match. A client record with the
 * email cleared has no agent to be the same person as, and letting "both
 * empty" count as agreement would turn a blanked field into access rather
 * than out of it.
 */
export function sameConnectorEmail(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return left !== "" && left === right;
}

/**
 * What a tool needs before it may be registered.
 *
 * Three write modes, not a boolean, because "may ask" is a real answer and
 * the middle rung is the one most coordinators want. A tool declares which
 * rung it belongs to and the ladder does the rest:
 *
 * - `"read"`: answering questions. Every level above no-access gets these.
 * - `"request"`: recording an ask for the coordinator. Only at APPROVE — at
 *   FULL there is nothing to ask, because the doing tool is registered
 *   instead, and offering both would make the assistant choose between
 *   asking and doing when the coordinator already chose.
 * - `"direct"`: changing a record. Only at FULL.
 * - `"write"`: either write rung. For asks that stay asks even at full
 *   access — starting a new file is the coordinator's act at every level.
 */
export type ClientToolRequirement = "read" | "request" | "direct" | "write";

/**
 * Filter a tool list to what this capability may use.
 *
 * Generic over anything carrying `requires` so it can live here, dependency-
 * free and tested, rather than beside the tool definitions where a value
 * import of Prisma would put it out of reach of the test runner.
 *
 * Filtering rather than checking inside each tool is the staff connector's
 * rule, and it holds for the same reason: a tool the caller may not use is
 * never registered, so the shape of what they cannot do never leaks.
 */
export function clientToolsFor<T extends { requires: ClientToolRequirement }>(
  capability: ClientConnectorCapability,
  all: readonly T[],
): T[] {
  if (!capability.read) return [];
  return all.filter((tool) => {
    switch (tool.requires) {
      case "read":
        return true;
      case "write":
        return capability.writes !== "none";
      default:
        return capability.writes === tool.requires;
    }
  });
}

/** Caps on what an outside assistant may write into the workspace. */
export const REQUEST_TITLE_MAX = 120;
export const REQUEST_NOTE_MAX = 1000;

export interface TaskAsk {
  title: string;
  note?: string;
}

/**
 * Validate and tidy an ask before it becomes a row.
 *
 * Free text written by an outside party's assistant, so it is capped and
 * trimmed here rather than trusted and truncated at display time. Newlines
 * survive in the note (a coordinator may well want a short list); control
 * characters do not.
 */
export function parseTaskAsk(
  title: unknown,
  note: unknown,
): { ok: true; ask: TaskAsk } | { ok: false; error: string } {
  if (typeof title !== "string") return { ok: false, error: "A title is required." };
  const cleanTitle = stripControl(title).trim();
  if (cleanTitle.length === 0) return { ok: false, error: "A title is required." };
  if (cleanTitle.length > REQUEST_TITLE_MAX) {
    return { ok: false, error: `Keep the title under ${REQUEST_TITLE_MAX} characters.` };
  }

  if (note === undefined || note === null || note === "")
    return { ok: true, ask: { title: cleanTitle } };
  if (typeof note !== "string") return { ok: false, error: "The note must be text." };
  const cleanNote = stripControl(note).trim();
  if (cleanNote.length > REQUEST_NOTE_MAX) {
    return { ok: false, error: `Keep the note under ${REQUEST_NOTE_MAX} characters.` };
  }
  return {
    ok: true,
    ask: cleanNote ? { title: cleanTitle, note: cleanNote } : { title: cleanTitle },
  };
}

/** Everything unprintable except the newline and tab a note may legitimately hold. */
function stripControl(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

/**
 * Resolve an address the assistant named to one of *this client's* files.
 *
 * The reason write tools take an address rather than an id: an id from the
 * model is an id the model could be talked into changing, whereas a match is
 * only ever attempted against the list the connection already resolved. A
 * wrong or malicious address cannot reach another client's file — the worst
 * case is no match, which is an error message.
 *
 * An exact address wins outright, so "12 Oak St" still resolves when the
 * client also has "12 Oak Street Unit B". Otherwise a single substring hit
 * resolves and several report the ambiguity rather than guessing, because
 * guessing puts a coordinator's task on the wrong file.
 */
export function matchOwnTransaction<T extends { propertyAddress: string }>(
  query: unknown,
  transactions: readonly T[],
): { kind: "one"; txn: T } | { kind: "none" } | { kind: "many"; options: string[] } {
  if (typeof query !== "string") return { kind: "none" };
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    // No address given and exactly one file: there is no ambiguity to resolve.
    return transactions.length === 1 ? { kind: "one", txn: transactions[0] } : { kind: "none" };
  }

  const exact = transactions.filter((t) => t.propertyAddress.trim().toLowerCase() === needle);
  if (exact.length === 1) return { kind: "one", txn: exact[0] };

  const hits = transactions.filter((t) => t.propertyAddress.toLowerCase().includes(needle));
  if (hits.length === 1) return { kind: "one", txn: hits[0] };
  if (hits.length === 0) return { kind: "none" };
  return { kind: "many", options: hits.map((t) => t.propertyAddress) };
}
