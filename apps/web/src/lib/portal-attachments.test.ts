import { describe, expect, it } from "vitest";
import {
  PORTAL_UNGROUPED,
  type PortalRow,
  portalDocumentIds,
  portalGroups,
  portalVisibility,
} from "./portal-attachments";

const doc = (id: string, visibleToClient = true) => ({
  id,
  filename: `${id}.pdf`,
  sizeBytes: 1024,
  visibleToClient,
});

const row = (over: Partial<PortalRow> = {}): PortalRow => ({
  id: "r1",
  label: "Row",
  folderId: null,
  sortOrder: 0,
  completedAt: null,
  omittedAt: null,
  visibleToClient: false,
  document: null,
  ...over,
});

describe("portalVisibility", () => {
  it("shares a row whose document is client-visible", () => {
    expect(portalVisibility(row({ document: doc("a") }))).toBe("shared");
  });

  it("hides a row whose document is not client-visible", () => {
    // The per-file toggle is the rule coordinators already know; the row's
    // own flag must not be able to override it into view.
    expect(portalVisibility(row({ document: doc("a", false), visibleToClient: true }))).toBe(
      "hidden",
    );
  });

  it("hides an outstanding row by default", () => {
    expect(portalVisibility(row())).toBe("hidden");
  });

  it("surfaces an outstanding row only once opted in", () => {
    expect(portalVisibility(row({ visibleToClient: true }))).toBe("awaiting");
  });

  it("hides omitted rows however they are flagged", () => {
    // "Not applicable" is a conclusion, not something to chase a client for.
    expect(portalVisibility(row({ omittedAt: new Date(), visibleToClient: true }))).toBe("hidden");
    expect(portalVisibility(row({ omittedAt: new Date(), document: doc("a") }))).toBe("hidden");
  });
});

describe("portalGroups", () => {
  const folders = [
    { id: "f2", name: "Listing", sortOrder: 2 },
    { id: "f1", name: "Contract", sortOrder: 1 },
  ];

  it("splits shared files from what is still awaited", () => {
    const groups = portalGroups(
      [
        row({ id: "a", folderId: "f1", document: doc("d1") }),
        row({ id: "b", folderId: "f1", label: "Survey", visibleToClient: true }),
      ],
      folders,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].shared.map((i) => i.document?.id)).toEqual(["d1"]);
    expect(groups[0].awaiting.map((i) => i.label)).toEqual(["Survey"]);
  });

  it("drops folders that end up empty", () => {
    // An empty heading tells a client only that something is being withheld.
    const groups = portalGroups([row({ folderId: "f1", document: doc("d1") })], folders);
    expect(groups.map((g) => g.name)).toEqual(["Contract"]);
  });

  it("returns nothing when the client may see nothing", () => {
    expect(portalGroups([row(), row({ document: doc("d", false) })], folders)).toEqual([]);
  });

  it("orders named folders first and loose files last", () => {
    const groups = portalGroups(
      [
        row({ id: "l", folderId: null, document: doc("d0") }),
        row({ id: "b", folderId: "f2", document: doc("d2") }),
        row({ id: "a", folderId: "f1", document: doc("d1") }),
      ],
      folders,
    );
    expect(groups.map((g) => g.name)).toEqual(["Contract", "Listing", PORTAL_UNGROUPED]);
  });

  it("puts a row pointing at an unknown folder with the loose files", () => {
    const groups = portalGroups([row({ folderId: "gone", document: doc("d1") })], folders);
    expect(groups.map((g) => g.name)).toEqual([PORTAL_UNGROUPED]);
  });

  it("keeps rows in sortOrder within a folder", () => {
    const groups = portalGroups(
      [
        row({ id: "b", label: "B", folderId: "f1", sortOrder: 2, document: doc("d2") }),
        row({ id: "a", label: "A", folderId: "f1", sortOrder: 1, document: doc("d1") }),
      ],
      folders,
    );
    expect(groups[0].shared.map((i) => i.label)).toEqual(["A", "B"]);
  });
});

describe("portalDocumentIds", () => {
  it("lists only documents the client may open", () => {
    const ids = portalDocumentIds([
      row({ document: doc("ok") }),
      row({ document: doc("hidden", false) }),
      row({ visibleToClient: true }),
      row({ omittedAt: new Date(), document: doc("omitted") }),
    ]);
    expect(ids).toEqual(["ok"]);
  });
});

describe("audience", () => {
  const shared = row({
    document: {
      id: "d",
      filename: "d.pdf",
      sizeBytes: 1,
      visibleToClient: false,
      visibleToAgent: true,
    },
  });

  it("reads the flag belonging to the portal that asked", () => {
    expect(portalVisibility(shared, "client")).toBe("hidden");
    expect(portalVisibility(shared, "agent")).toBe("shared");
  });

  it("never offers 'still needed' to an agent portal", () => {
    // The opt-in is a decision about what to tell the *client*; reusing it
    // to publish the checklist to agents is a decision nobody made.
    const awaited = row({ visibleToClient: true });
    expect(portalVisibility(awaited, "client")).toBe("awaiting");
    expect(portalVisibility(awaited, "agent")).toBe("hidden");
  });
});
