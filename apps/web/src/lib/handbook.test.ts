import { describe, expect, it } from "vitest";
import {
  canReadGrade,
  canReadNotes,
  canSetGrade,
  currentNotes,
  GRADE_LABEL,
  GRADE_VALUES,
  gradeTone,
  type HandbookNoteLike,
  type HandbookSubjectType,
  isExpired,
  type MemberRole,
  poolForTransaction,
  summaryNotesFor,
  type Viewer,
} from "./handbook";

const NOW = new Date("2026-07-30T12:00:00.000Z");

const note = (
  over: Partial<HandbookNoteLike> & { subjectType: HandbookSubjectType; subjectId: string },
): HandbookNoteLike => ({
  id: `${over.subjectType}:${over.subjectId}:${over.body ?? ""}`,
  body: "something worth knowing",
  authorName: "Priya",
  relevantUntil: null,
  createdAt: NOW,
  ...over,
});

const viewer = (role: MemberRole, memberId = "me"): Viewer => ({ memberId, role });
const ROLES: MemberRole[] = ["owner", "admin", "member"];

describe("who can see notes about people", () => {
  it("keeps member notes to owners and admins", () => {
    // "Needs to improve phone communication" is a management record. A
    // regular member seeing it is the failure this feature must not have.
    expect(canReadNotes(viewer("owner"), "MEMBER")).toBe(true);
    expect(canReadNotes(viewer("admin"), "MEMBER")).toBe(true);
    expect(canReadNotes(viewer("member"), "MEMBER")).toBe(false);
  });

  it("hides a member's notes even from that member", () => {
    // Deliberate: a coaching note its subject can read is one nobody writes
    // honestly, and the feature quietly stops being used.
    expect(canReadNotes(viewer("member", "priya"), "MEMBER")).toBe(false);
  });

  it("leaves every other kind of note open to the whole team", () => {
    for (const role of ROLES) {
      for (const t of ["CLIENT", "CONTACT", "TRANSACTION"] as HandbookSubjectType[]) {
        expect(canReadNotes(viewer(role), t), `${role} / ${t}`).toBe(true);
      }
    }
  });
});

describe("grades", () => {
  it("are visible to everyone, unlike member notes", () => {
    // The asymmetry is the point: a new coordinator has to see the F, or they
    // accept work the business already refused.
    expect(canReadGrade()).toBe(true);
  });

  it("are only set by owners and admins", () => {
    expect(canSetGrade(viewer("owner"))).toBe(true);
    expect(canSetGrade(viewer("admin"))).toBe(true);
    expect(canSetGrade(viewer("member"))).toBe(false);
  });

  it("uses the A–F school scale, which has no E", () => {
    expect(GRADE_VALUES).toEqual(["A", "B", "C", "D", "F"]);
    expect(GRADE_VALUES).not.toContain("E");
  });

  it("labels every grade and escalates tone at the bottom of the scale", () => {
    for (const g of GRADE_VALUES) expect(GRADE_LABEL[g].length).toBeGreaterThan(1);
    expect(gradeTone("A")).toBe("success");
    expect(gradeTone("D")).toBe("warning");
    expect(gradeTone("F")).toBe("danger");
  });
});

describe("expiry", () => {
  const dated = (d: string) =>
    note({ subjectType: "CLIENT", subjectId: "c1", relevantUntil: new Date(d) });

  it("keeps a note through the whole of its last day", () => {
    // "On holiday until 30 April" is still true at 11pm on the 30th.
    expect(isExpired(dated("2026-07-30"), NOW)).toBe(false);
  });

  it("drops it the day after", () => {
    expect(isExpired(dated("2026-07-29"), NOW)).toBe(true);
  });

  it("never expires a note without a date", () => {
    expect(isExpired(note({ subjectType: "CLIENT", subjectId: "c1" }), NOW)).toBe(false);
  });

  it("ignores the time of day on either side", () => {
    // The column is a DATE; a late-in-the-day "now" must not retire a note
    // early just because the stored midnight is behind it.
    const late = new Date("2026-07-30T23:59:59.000Z");
    expect(isExpired(dated("2026-07-30"), late)).toBe(false);
  });

  it("filters a mixed list down to what is still true", () => {
    const notes = [
      note({ subjectType: "CLIENT", subjectId: "c1", body: "standing" }),
      note({
        subjectType: "CLIENT",
        subjectId: "c1",
        body: "away last week",
        relevantUntil: new Date("2026-07-20"),
      }),
      note({
        subjectType: "CLIENT",
        subjectId: "c1",
        body: "away next year",
        relevantUntil: new Date("2027-04-30"),
      }),
    ];
    expect(currentNotes(notes, NOW).map((n) => n.body)).toEqual(["standing", "away next year"]);
  });
});

describe("poolForTransaction", () => {
  const input = {
    transaction: {
      id: "t1",
      label: "412 Maple Avenue",
      notes: [note({ subjectType: "TRANSACTION", subjectId: "t1", body: "rush closing" })],
    },
    client: {
      id: "cl1",
      label: "Sunrise Realty",
      notes: [
        note({ subjectType: "CLIENT", subjectId: "cl1", body: "broker reviews before payment" }),
      ],
    },
    contacts: [
      {
        id: "co1",
        label: "Plymouth Signs",
        notes: [note({ subjectType: "CONTACT", subjectId: "co1", body: "Plymouth County only" })],
      },
    ],
  };

  it("reaches up to the client and the parties, not just the file", () => {
    // The reason the feature works at all: a standing instruction is written
    // once on the client, not copied onto all eleven of their files.
    const pooled = poolForTransaction(input, NOW);
    expect(pooled.map((p) => p.note.body)).toEqual([
      "rush closing",
      "broker reviews before payment",
      "Plymouth County only",
    ]);
  });

  it("labels each note with where it came from, so the panel can link back", () => {
    const pooled = poolForTransaction(input, NOW);
    expect(pooled.map((p) => [p.source.type, p.source.label])).toEqual([
      ["TRANSACTION", "412 Maple Avenue"],
      ["CLIENT", "Sunrise Realty"],
      ["CONTACT", "Plymouth Signs"],
    ]);
  });

  it("never pools a note about a person, for anyone", () => {
    // Even if one is somehow attached, a panel the whole team reads is the
    // last place a staff record belongs. There is no flag that enables this.
    const withMember = {
      ...input,
      transaction: {
        ...input.transaction,
        notes: [
          ...input.transaction.notes,
          note({ subjectType: "MEMBER", subjectId: "m1", body: "proofread her emails" }),
        ],
      },
    };
    const bodies = poolForTransaction(withMember, NOW).map((p) => p.note.body);
    expect(bodies).not.toContain("proofread her emails");
  });

  it("leaves out notes that have expired", () => {
    const withStale = {
      ...input,
      client: {
        ...input.client,
        notes: [
          ...input.client.notes,
          note({
            subjectType: "CLIENT",
            subjectId: "cl1",
            body: "away in June",
            relevantUntil: new Date("2026-06-30"),
          }),
        ],
      },
    };
    expect(poolForTransaction(withStale, NOW).map((p) => p.note.body)).not.toContain(
      "away in June",
    );
  });

  it("copes with a file that has no client and no parties", () => {
    const bare = { transaction: { id: "t1", label: "x", notes: [] }, client: null, contacts: [] };
    expect(poolForTransaction(bare, NOW)).toEqual([]);
  });
});

describe("summaryNotesFor", () => {
  const notes = [
    note({ subjectType: "CLIENT", subjectId: "cl1", body: "call about date changes" }),
    note({ subjectType: "MEMBER", subjectId: "priya", body: "proofread her emails" }),
    note({ subjectType: "MEMBER", subjectId: "me", body: "works evenings" }),
  ];

  it("never feeds a member note into a non-admin's summary", () => {
    const bodies = summaryNotesFor(viewer("member", "priya"), notes, NOW).map((n) => n.body);
    expect(bodies).toEqual(["call about date changes"]);
  });

  it("lets an admin's summary use notes about their team", () => {
    const bodies = summaryNotesFor(viewer("admin", "me"), notes, NOW).map((n) => n.body);
    expect(bodies).toContain("proofread her emails");
  });

  it("still leaves out the reader's own note, even for an admin", () => {
    // Otherwise the summary quotes an admin's own staff record back at them,
    // which reads as the software grading its user.
    const bodies = summaryNotesFor(viewer("admin", "me"), notes, NOW).map((n) => n.body);
    expect(bodies).not.toContain("works evenings");
  });

  it("applies expiry as well as visibility", () => {
    const withStale = [
      ...notes,
      note({
        subjectType: "CLIENT",
        subjectId: "cl1",
        body: "was away in June",
        relevantUntil: new Date("2026-06-01"),
      }),
    ];
    const bodies = summaryNotesFor(viewer("owner", "me"), withStale, NOW).map((n) => n.body);
    expect(bodies).not.toContain("was away in June");
  });
});
