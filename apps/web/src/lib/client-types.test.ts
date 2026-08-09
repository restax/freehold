import { describe, expect, it } from "vitest";
import {
  type ClientTypeSettings,
  canDisableGroup,
  groupEnabled,
  offeredClientTypes,
  transactionLayout,
} from "./client-types";

const settings = (over: Partial<ClientTypeSettings> = {}): ClientTypeSettings => ({
  clientTypeAgentEnabled: true,
  clientTypeOfficeEnabled: true,
  privateLendingEnabled: false,
  ...over,
});

describe("offeredClientTypes", () => {
  it("offers agents and offices by default, and not private lender", () => {
    const offered = offeredClientTypes(settings());
    expect(offered).toContain("AGENT");
    expect(offered).toContain("BROKERAGE");
    expect(offered).toContain("TEAM");
    expect(offered).not.toContain("PRIVATE_LENDER");
  });

  it("adds private lender once the workspace switches it on", () => {
    expect(offeredClientTypes(settings({ privateLendingEnabled: true }))).toContain(
      "PRIVATE_LENDER",
    );
  });

  it("always offers the incidental counterparties", () => {
    // A file still needs to name its title company even in a workspace that
    // has switched every line of work off.
    const offered = offeredClientTypes(
      settings({ clientTypeAgentEnabled: false, clientTypeOfficeEnabled: false }),
    );
    expect(offered).toEqual(["TITLE", "LENDER", "OTHER"]);
  });
});

describe("groupEnabled", () => {
  it("reads the switch behind each group", () => {
    const s = settings({ clientTypeOfficeEnabled: false, privateLendingEnabled: true });
    expect(groupEnabled("agent", s)).toBe(true);
    expect(groupEnabled("office", s)).toBe(false);
    expect(groupEnabled("privateLender", s)).toBe(true);
  });
});

describe("canDisableGroup", () => {
  it("refuses to switch off a line of work that has clients", () => {
    expect(canDisableGroup(0)).toBe(true);
    expect(canDisableGroup(1)).toBe(false);
  });
});

describe("transactionLayout", () => {
  it("gives a private lender's file the lending screen", () => {
    expect(transactionLayout("PRIVATE_LENDER", { privateLendingEnabled: true })).toBe("lending");
  });

  it("leaves every other client type on the standard screen", () => {
    const on = { privateLendingEnabled: true };
    expect(transactionLayout("AGENT", on)).toBe("standard");
    expect(transactionLayout("BROKERAGE", on)).toBe("standard");
    // The mortgage company on a normal sale is not a private lender.
    expect(transactionLayout("LENDER", on)).toBe("standard");
  });

  it("falls back to standard for a file with no client", () => {
    expect(transactionLayout(null, { privateLendingEnabled: true })).toBe("standard");
    expect(transactionLayout(undefined, { privateLendingEnabled: true })).toBe("standard");
  });

  it("returns lending files to the standard screen when the switch goes off", () => {
    // Otherwise a workspace that changed its mind is stranded on a layout it
    // no longer uses, with no way back from the file itself.
    expect(transactionLayout("PRIVATE_LENDER", { privateLendingEnabled: false })).toBe("standard");
  });
});
