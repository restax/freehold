/**
 * What a person's Claude connector may do in a given workspace.
 *
 * Two gates, and both must open. The workspace switch belongs to the
 * subscriber paying for the account; the per-member grant belongs to whoever
 * runs the team. Either one saying no is enough, which is why the workspace
 * flag is a parameter here rather than something callers check separately and
 * sometimes forget to.
 *
 * Deliberately dependency-free, the billing-access pattern, so the whole
 * table is unit-testable. This function is the only place that decides, and
 * it is called on *every* tool call rather than once when a token is minted —
 * that is what makes a demotion take effect on someone's next message to
 * Claude instead of whenever their refresh token happens to lapse.
 */
export interface McpCapability {
  /** Read the workspace: search files, look up people, see what's due. */
  read: boolean;
  /** Change the workspace: create tasks, add notes, move a status. */
  write: boolean;
}

export const NO_MCP_ACCESS: McpCapability = { read: false, write: false };

export const MCP_ROLE_OPTIONS: Array<[string, string]> = [
  ["default", "Follows role"],
  ["none", "No access"],
  ["read", "Read only"],
  ["write", "Read and write"],
];

export function mcpCapability(
  role: string | null | undefined,
  mcpRole: string | null | undefined,
  workspaceEnabled: boolean,
): McpCapability {
  // The subscriber's switch wins over everything, including their own grant.
  // Turning the connector off means off — not "off unless you were already
  // allowed", which is how a kill switch quietly stops being one.
  if (!workspaceEnabled) return NO_MCP_ACCESS;

  // Outside coverage staff are in this workspace to work specific files under
  // an engagement. They never get a general-purpose window onto it.
  if (role === "guest") return NO_MCP_ACCESS;

  // The owner cannot be locked out by a grant — they'd have no way back in,
  // since the Team page is where grants are edited. If they want their own
  // access gone, the workspace switch above is the honest way to do it.
  if (role === "owner") return { read: true, write: true };

  // An explicit grant beats the role default in both directions, so an admin
  // can be cut off individually without demoting them out of admin.
  switch (mcpRole) {
    case "none":
      return NO_MCP_ACCESS;
    case "read":
      return { read: true, write: false };
    case "write":
      return { read: true, write: true };
  }

  // No grant recorded: fall back to what the role implies. A plain member
  // reads but does not write, because an assistant quietly changing a file is
  // a bigger surprise than one that merely answers questions about it.
  if (role === "admin") return { read: true, write: true };
  return { read: true, write: false };
}

/** Label for the Team page: what this member's connector access reads as. */
export function mcpRoleLabel(
  role: string | null | undefined,
  mcpRole: string | null | undefined,
  workspaceEnabled: boolean,
): string {
  if (!workspaceEnabled) return "Connector off for this workspace";
  const cap = mcpCapability(role, mcpRole, workspaceEnabled);
  if (cap.write) return "Read and write";
  if (cap.read) return "Read only";
  return "No access";
}
