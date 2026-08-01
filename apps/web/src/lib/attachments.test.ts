import { describe, expect, it } from "vitest";
import {
  type AttachmentLike,
  attachmentState,
  filterAttachments,
  groupAttachments,
  linkLabel,
  progressOf,
  safeExternalUrl,
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

describe("safeExternalUrl", () => {
  it("keeps a normal https link", () => {
    expect(safeExternalUrl("https://example.org/deed.pdf")).toBe("https://example.org/deed.pdf");
  });

  it("upgrades a bare host rather than refusing it", () => {
    expect(safeExternalUrl("drive.example.com/x")).toBe("https://drive.example.com/x");
  });

  it("rejects javascript: and data: — these land straight in an href", () => {
    // A link the whole workspace can click is stored XSS if this leaks.
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects control characters used to smuggle a scheme past a parser", () => {
    expect(safeExternalUrl("java\tscript:alert(1)")).toBeNull();
    expect(safeExternalUrl("java\nscript:alert(1)")).toBeNull();
  });

  it("rejects file: and other non-web schemes", () => {
    expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
    expect(safeExternalUrl("ftp://example.org")).toBeNull();
  });

  it("treats blank as absent", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("linkLabel", () => {
  it("shows the host without www", () => {
    expect(linkLabel("https://www.dropbox.com/s/abc")).toBe("dropbox.com");
  });

  it("falls back to the raw string when unparseable", () => {
    expect(linkLabel("not a url")).toBe("not a url");
  });
});

describe("filterAttachments", () => {
  const rows = [
    row({ label: "Purchase agreement", completedAt: new Date() }),
    row({ label: "Survey" }),
    row({ label: "Lead paint", omittedAt: new Date() }),
    { ...row({ label: "Scan" }), document: { filename: "title-commitment.pdf" } },
  ];

  it("matches the row label", () => {
    expect(filterAttachments(rows, { q: "surv" }).map((r) => r.label)).toEqual(["Survey"]);
  });

  it("also matches the attached file name", () => {
    // The row is called "Scan" but people search for what the file is.
    expect(filterAttachments(rows, { q: "title-commit" }).map((r) => r.label)).toEqual(["Scan"]);
  });

  it("is case-insensitive", () => {
    expect(filterAttachments(rows, { q: "SURVEY" })).toHaveLength(1);
  });

  it("hides completed rows on request", () => {
    expect(filterAttachments(rows, { hideComplete: true }).map((r) => r.label)).not.toContain(
      "Purchase agreement",
    );
  });

  it("hides omitted rows on request", () => {
    expect(filterAttachments(rows, { hideOmitted: true }).map((r) => r.label)).not.toContain(
      "Lead paint",
    );
  });

  it("combines a search with the filters", () => {
    const out = filterAttachments(rows, { q: "a", hideComplete: true, hideOmitted: true });
    expect(out.map((r) => r.label)).toEqual(["Scan"]);
  });

  it("returns everything when nothing is asked for", () => {
    expect(filterAttachments(rows, {})).toHaveLength(4);
  });
});
