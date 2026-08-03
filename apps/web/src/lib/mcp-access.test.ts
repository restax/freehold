import { describe, expect, it } from "vitest";
import { MCP_ROLE_OPTIONS, mcpCapability, mcpRoleLabel, NO_MCP_ACCESS } from "./mcp-access";

const ON = true;
const OFF = false;

describe("the workspace switch", () => {
  it("beats every role and every grant", () => {
    // The whole point of a kill switch: a subscriber who turns the connector
    // off should not have to also audit who was granted what.
    for (const role of ["owner", "admin", "member", "guest"]) {
      for (const grant of [null, "read", "write", "none"]) {
        expect(mcpCapability(role, grant, OFF), `${role}/${grant}`).toEqual(NO_MCP_ACCESS);
      }
    }
  });

  it("says so plainly in the Team page label", () => {
    expect(mcpRoleLabel("owner", "write", OFF)).toBe("Connector off for this workspace");
  });
});

describe("guests", () => {
  it("never get connector access, whatever the grant says", () => {
    // A guest is covering specific files under an engagement. A general
    // window onto the workspace is exactly what they must not have.
    for (const grant of [null, "read", "write"]) {
      expect(mcpCapability("guest", grant, ON), String(grant)).toEqual(NO_MCP_ACCESS);
    }
  });
});

describe("the owner", () => {
  it("keeps full access even if a grant says otherwise", () => {
    // Grants are edited on the Team page. An owner who locked themselves out
    // with "none" would have no route back in.
    expect(mcpCapability("owner", "none", ON)).toEqual({ read: true, write: true });
    expect(mcpCapability("owner", "read", ON)).toEqual({ read: true, write: true });
    expect(mcpCapability("owner", null, ON)).toEqual({ read: true, write: true });
  });
});

describe("role defaults, with no grant recorded", () => {
  it("lets an admin read and write", () => {
    expect(mcpCapability("admin", null, ON)).toEqual({ read: true, write: true });
  });

  it("lets a plain member read but not write", () => {
    // An assistant answering questions about a file is a much smaller
    // surprise than one quietly changing it.
    expect(mcpCapability("member", null, ON)).toEqual({ read: true, write: false });
  });

  it("treats an unknown role as a plain member rather than an admin", () => {
    // Roles are strings, so a typo or a future role must fail downward.
    expect(mcpCapability("supervisor", null, ON)).toEqual({ read: true, write: false });
    expect(mcpCapability(null, null, ON)).toEqual({ read: true, write: false });
    expect(mcpCapability(undefined, undefined, ON)).toEqual({ read: true, write: false });
  });
});

describe("an explicit grant", () => {
  it("cuts one person off without touching their role", () => {
    // The case the user asked for: switch it off for a specific user. An admin
    // stays an admin everywhere else in the product.
    expect(mcpCapability("admin", "none", ON)).toEqual(NO_MCP_ACCESS);
    expect(mcpCapability("member", "none", ON)).toEqual(NO_MCP_ACCESS);
  });

  it("promotes a member to writing", () => {
    expect(mcpCapability("member", "write", ON)).toEqual({ read: true, write: true });
  });

  it("demotes an admin to reading", () => {
    expect(mcpCapability("admin", "read", ON)).toEqual({ read: true, write: false });
  });

  it("ignores a value that isn't one of the options", () => {
    // Unrecognised strings fall through to the role default rather than
    // opening anything up — the safe direction for a column anyone can write.
    expect(mcpCapability("member", "admin", ON)).toEqual({ read: true, write: false });
    expect(mcpCapability("member", "", ON)).toEqual({ read: true, write: false });
    expect(mcpCapability("member", "WRITE", ON)).toEqual({ read: true, write: false });
  });
});

describe("write always implies read", () => {
  it("holds for every combination the resolver can produce", () => {
    for (const role of ["owner", "admin", "member", "guest", "other"]) {
      for (const grant of [null, "none", "read", "write", "junk"]) {
        for (const enabled of [ON, OFF]) {
          const cap = mcpCapability(role, grant, enabled);
          if (cap.write) {
            expect(cap.read, `${role}/${grant}/${enabled}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("the Team page options", () => {
  it("offers exactly the values the resolver understands", () => {
    const values = MCP_ROLE_OPTIONS.map(([v]) => v);
    expect(values).toEqual(["default", "none", "read", "write"]);
  });

  it("labels each resolved level distinctly", () => {
    expect(mcpRoleLabel("member", "none", ON)).toBe("No access");
    expect(mcpRoleLabel("member", null, ON)).toBe("Read only");
    expect(mcpRoleLabel("admin", null, ON)).toBe("Read and write");
  });
});
