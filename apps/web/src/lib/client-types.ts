/**
 * Which kinds of client a workspace takes on, and what that implies for the
 * transaction screen.
 *
 * A TC coordinating sales for agents and offices, and one coordinating loans
 * for a private lender, are doing different jobs on differently shaped files.
 * Rather than bolt lending fields onto the sale screen for everyone, a
 * workspace says which lines of work it is in, and a file is laid out to suit
 * the client it belongs to.
 *
 * Dependency-free so the rules are unit-tested, same pattern as
 * client-profile.ts and billing-cadence.
 */

/** The switches a workspace holds, as stored on Organization. */
export interface ClientTypeSettings {
  clientTypeAgentEnabled: boolean;
  clientTypeOfficeEnabled: boolean;
  privateLendingEnabled: boolean;
}

/** The three lines of work a workspace can switch on. Title/lender/other stay
 *  always-available: they are incidental counterparties a file needs to name,
 *  not a business a TC chooses to be in. */
export type ClientTypeGroup = "agent" | "office" | "privateLender";

export const CLIENT_TYPE_GROUPS: Array<{
  key: ClientTypeGroup;
  label: string;
  hint: string;
  /** The ClientType values this switch governs. */
  types: string[];
}> = [
  {
    key: "agent",
    label: "Individual agent",
    hint: "An agent who hangs their license with a brokerage you keep on file.",
    types: ["AGENT"],
  },
  {
    key: "office",
    label: "Broker or team",
    hint: "An office with a roster of agents and, usually, someone who pays the invoices.",
    types: ["BROKERAGE", "TEAM"],
  },
  {
    key: "privateLender",
    label: "Private lender",
    hint: "A private or hard-money lender whose files are loans rather than sales. Their transactions use a lending screen.",
    types: ["PRIVATE_LENDER"],
  },
];

export function groupEnabled(group: ClientTypeGroup, s: ClientTypeSettings): boolean {
  if (group === "agent") return s.clientTypeAgentEnabled;
  if (group === "office") return s.clientTypeOfficeEnabled;
  return s.privateLendingEnabled;
}

/**
 * The client types offered when creating a client.
 *
 * Only the three switchable lines of work are gated. Title, lender and other
 * are always offered: a file needs to be able to name the title company it is
 * closing with regardless of what business the workspace is in.
 */
export function offeredClientTypes(s: ClientTypeSettings): string[] {
  const offered: string[] = [];
  if (s.clientTypeAgentEnabled) offered.push("AGENT");
  if (s.clientTypeOfficeEnabled) offered.push("BROKERAGE", "TEAM");
  if (s.privateLendingEnabled) offered.push("PRIVATE_LENDER");
  offered.push("TITLE", "LENDER", "OTHER");
  return offered;
}

/**
 * Whether a switch may be turned off.
 *
 * Switching a line of work off hides it from the create form; it must never
 * orphan clients that already exist under it. The count comes from the caller
 * so this stays dependency-free.
 */
export function canDisableGroup(inUseCount: number): boolean {
  return inUseCount === 0;
}

/** Which transaction screen a file gets. */
export type TransactionLayout = "standard" | "lending";

/**
 * The layout for a file, from the type of client it belongs to.
 *
 * Driven by the client on the file rather than a per-file setting: a private
 * lender's files are loans, and asking someone to pick the right screen every
 * time is a step that will eventually be got wrong.
 *
 * The workspace switch is checked too, so turning private lending back off
 * returns those files to the standard screen instead of leaving them on a
 * layout the workspace no longer uses.
 */
export function transactionLayout(
  clientType: string | null | undefined,
  s: Pick<ClientTypeSettings, "privateLendingEnabled">,
): TransactionLayout {
  if (!s.privateLendingEnabled) return "standard";
  return clientType === "PRIVATE_LENDER" ? "lending" : "standard";
}
