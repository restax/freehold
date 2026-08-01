import { describe, expect, it } from "vitest";
import {
  isTracking,
  pruneSignatures,
  readSignatureState,
  signAll,
  signatureProgress,
  signerParties,
  toggleSigner,
} from "./signature-tracking";

const party = (id: string, role: string, name = id) => ({ id, role, contact: { name } });

const PARTIES = [
  party("p1", "LISTING_AGENT", "Rita"),
  party("p2", "BUYER", "Jordan"),
  party("p3", "LENDER", "Morgan"),
  party("p4", "SELLER", "Dana"),
];

describe("readSignatureState", () => {
  it("reads a plain map", () => {
    expect(readSignatureState({ p1: "2026-01-01T00:00:00.000Z" })).toEqual({
      p1: "2026-01-01T00:00:00.000Z",
    });
  });

  it("treats an empty map as tracking-but-nobody-signed", () => {
    expect(readSignatureState({})).toEqual({});
    expect(isTracking({})).toBe(true);
  });

  it("treats null/absent as not tracking", () => {
    expect(readSignatureState(null)).toBeNull();
    expect(readSignatureState(undefined)).toBeNull();
    expect(isTracking(null)).toBe(false);
  });

  it("ignores shapes that aren't a string map", () => {
    // The column is Json? — an older shape or hand-edited data shouldn't be
    // trusted into the UI as if it were signatures.
    expect(readSignatureState(["p1"])).toBeNull();
    expect(readSignatureState("nope")).toBeNull();
    expect(readSignatureState({ p1: 5, p2: "ok" })).toEqual({ p2: "ok" });
  });
});

describe("signerParties", () => {
  it("keeps only signing roles", () => {
    expect(signerParties(PARTIES).map((p) => p.id)).not.toContain("p3"); // lender
  });

  it("orders buyer, seller, buyer's agent, listing agent", () => {
    expect(signerParties(PARTIES).map((p) => p.role)).toEqual(["BUYER", "SELLER", "LISTING_AGENT"]);
  });

  it("keeps two parties in the same role as two signers", () => {
    // A role-keyed map would merge these into one pill and lose a signature.
    const two = [party("a", "BUYER", "Ann"), party("b", "BUYER", "Bob")];
    expect(signerParties(two).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("returns nothing when no party can sign", () => {
    expect(signerParties([party("x", "INSPECTOR")])).toEqual([]);
  });
});

describe("signatureProgress", () => {
  const signers = signerParties(PARTIES);

  it("counts signed against the signers on the file", () => {
    expect(signatureProgress({ p2: "t" }, signers)).toEqual({
      signed: 1,
      total: 3,
      complete: false,
    });
  });

  it("is complete only when everyone has signed", () => {
    const all = { p1: "t", p2: "t", p4: "t" };
    expect(signatureProgress(all, signers).complete).toBe(true);
  });

  it("is never complete with nobody to sign", () => {
    // Otherwise a file with no parties would claim a fully executed document.
    expect(signatureProgress({}, [])).toEqual({ signed: 0, total: 0, complete: false });
  });

  it("ignores entries for parties no longer on the file", () => {
    expect(signatureProgress({ p2: "t", ghost: "t" }, signers).signed).toBe(1);
  });

  it("reads as unsigned when tracking is off", () => {
    expect(signatureProgress(null, signers)).toEqual({ signed: 0, total: 3, complete: false });
  });
});

describe("toggleSigner", () => {
  it("ticks an unsigned party", () => {
    const at = new Date("2026-03-04T05:06:07.000Z");
    expect(toggleSigner({}, "p2", at)).toEqual({ p2: "2026-03-04T05:06:07.000Z" });
  });

  it("unticks a signed one", () => {
    expect(toggleSigner({ p2: "t" }, "p2")).toEqual({});
  });

  it("leaves the other parties alone and does not mutate", () => {
    const before = { p1: "t1" };
    const after = toggleSigner(before, "p2", new Date("2026-01-01T00:00:00.000Z"));
    expect(before).toEqual({ p1: "t1" });
    expect(after.p1).toBe("t1");
  });
});

describe("signAll", () => {
  const signers = signerParties(PARTIES);

  it("signs everyone who hasn't", () => {
    const at = new Date("2026-05-05T00:00:00.000Z");
    expect(signAll({}, signers, at)).toEqual({
      p2: at.toISOString(),
      p4: at.toISOString(),
      p1: at.toISOString(),
    });
  });

  it("keeps an existing signature's own timestamp", () => {
    // Restamping would rewrite history to claim everyone signed at once.
    const out = signAll({ p2: "earlier" }, signers, new Date("2026-05-05T00:00:00.000Z"));
    expect(out.p2).toBe("earlier");
  });
});

describe("pruneSignatures", () => {
  it("drops parties who left the file", () => {
    expect(pruneSignatures({ p2: "t", ghost: "t" }, signerParties(PARTIES))).toEqual({ p2: "t" });
  });

  it("turns absent state into an empty map", () => {
    expect(pruneSignatures(null, signerParties(PARTIES))).toEqual({});
  });
});
