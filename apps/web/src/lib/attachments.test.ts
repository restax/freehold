import { describe, expect, it } from "vitest";
import {
  type AttachmentLike,
  attachmentState,
  groupAttachments,
  progressOf,
  UNGROUPED_LABEL,
} from "./attachments";

const row = (over: Partial<AttachmentLike> = {}): AttachmentLike => ({
  completedAt: null,
  omittedAt: null,
  required: true,
  folderId: null,
  sortOrder: 0,
  label: "row",
  ...over,
});

describe("attachmentState", () => {
  it("is pending with neither timestamp set", () => {
    expect(attachmentState(row())).toBe("pending");
  });

  it("is complete once completedAt is set, file or no file", () => {
    expect(attachmentState(row({ completedAt: new Date() }))).toBe("complete");
  });

  it("lets omitted win over complete", () => {
    // A row ruled not-applicable is off the books even if somebody had already
    // marked it done — otherwise un-omitting is the only way to see the truth.
    expect(attachmentState(row({ completedAt: new Date(), omittedAt: new Date() }))).toBe(
      "omitted",
    );
  });
});

describe("progressOf", () => {
  it("counts completed over total", () => {
    expect(progressOf([row({ completedAt: new Date() }), row(), row()])).toEqual({
      done: 1,
      total: 3,
      pct: 33,
    });
  });

  it("drops omitted rows out of the denominator entirely", () => {
    const rows = [row({ completedAt: new Date() }), row({ completedAt: new Date() }), row()];
    expect(progressOf(rows)).toEqual({ done: 2, total: 3, pct: 67 });
    // Ruling the last one N/A should complete the folder, not leave it at 2/3.
    const withOmit = [rows[0], rows[1], row({ omittedAt: new Date() })];
    expect(progressOf(withOmit)).toEqual({ done: 2, total: 2, pct: 100 });
  });

  it("reads an empty set as done rather than zero", () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 100 });
    expect(progressOf([row({ omittedAt: new Date() })])).toEqual({ done: 0, total: 0, pct: 100 });
  });
});

describe("groupAttachments", () => {
  const folders = [
    { id: "f2", name: "Listing", sortOrder: 2 },
    { id: "f1", name: "Contract", sortOrder: 1 },
  ];

  it("orders folders by sortOrder and puts ungrouped last", () => {
    const rows = [
      row({ label: "loose", folderId: null }),
      row({ label: "listing", folderId: "f2" }),
      row({ label: "contract", folderId: "f1" }),
    ];
    expect(groupAttachments(rows, folders).map((g) => g.name)).toEqual([
      "Contract",
      "Listing",
      UNGROUPED_LABEL,
    ]);
  });

  it("keeps empty folders visible", () => {
    const groups = groupAttachments([row({ folderId: "f1" })], folders);
    const listing = groups.find((g) => g.name === "Listing");
    expect(listing?.rows).toEqual([]);
    expect(listing?.progress.pct).toBe(100);
  });

  it("omits the ungrouped bucket when nothing is loose", () => {
    const groups = groupAttachments([row({ folderId: "f1" })], folders);
    expect(groups.some((g) => g.folderId === null)).toBe(false);
  });

  it("falls back to ungrouped for a row pointing at a deleted folder", () => {
    // SetNull covers the normal path, but a stale id shouldn't make the row
    // disappear from the tab — that loses a file with no trace.
    const groups = groupAttachments([row({ label: "orphan", folderId: "gone" })], folders);
    const loose = groups.find((g) => g.folderId === null);
    expect(loose?.rows.map((r) => r.label)).toEqual(["orphan"]);
  });

  it("sorts rows within a folder by sortOrder", () => {
    const rows = [
      row({ label: "b", folderId: "f1", sortOrder: 2 }),
      row({ label: "a", folderId: "f1", sortOrder: 1 }),
    ];
    const contract = groupAttachments(rows, folders).find((g) => g.name === "Contract");
    expect(contract?.rows.map((r) => r.label)).toEqual(["a", "b"]);
  });

  it("computes progress per folder, not across the file", () => {
    const rows = [
      row({ folderId: "f1", completedAt: new Date() }),
      row({ folderId: "f1" }),
      row({ folderId: "f2", completedAt: new Date() }),
    ];
    const groups = groupAttachments(rows, folders);
    expect(groups.find((g) => g.name === "Contract")?.progress).toEqual({
      done: 1,
      total: 2,
      pct: 50,
    });
    expect(groups.find((g) => g.name === "Listing")?.progress).toEqual({
      done: 1,
      total: 1,
      pct: 100,
    });
  });
});
