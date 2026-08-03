import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_GROUPS, PRESENTER_PROMPTS, SOCIAL_POSTS } from "./social-kit";

const PUBLIC_SOCIAL = join(process.cwd(), "public", "marketing", "social");
const topLevel = new Set(readdirSync(PUBLIC_SOCIAL));
// Assets may live one level down (e.g. "presenter/shot-1.jpg"); check both.
const onDisk = {
  has: (file: string) => topLevel.has(file) || existsSync(join(PUBLIC_SOCIAL, file)),
};

describe("the post list", () => {
  it("has unique ids", () => {
    const ids = SOCIAL_POSTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives the operator the 20 posts requested, in both lengths", () => {
    expect(SOCIAL_POSTS.length).toBeGreaterThanOrEqual(20);
    expect(SOCIAL_POSTS.filter((p) => p.length === "short").length).toBeGreaterThanOrEqual(8);
    expect(SOCIAL_POSTS.filter((p) => p.length === "long").length).toBeGreaterThanOrEqual(6);
  });

  it("covers both voices, in both lengths", () => {
    for (const voice of ["founder", "company"] as const) {
      const mine = SOCIAL_POSTS.filter((p) => p.voice === voice);
      expect(mine.length, voice).toBeGreaterThanOrEqual(10);
      expect(
        mine.some((p) => p.length === "short"),
        voice,
      ).toBe(true);
      expect(
        mine.some((p) => p.length === "long"),
        voice,
      ).toBe(true);
    }
  });

  it("keeps the short ones actually short", () => {
    // A group post that runs long gets scrolled past. Two lines, near enough.
    for (const p of SOCIAL_POSTS.filter((p) => p.length === "short")) {
      expect(p.body.length, p.id).toBeLessThanOrEqual(210);
      expect(p.body.split("\n\n").length, p.id).toBe(1);
    }
  });

  it("every post points somewhere", () => {
    for (const p of SOCIAL_POSTS) {
      expect(p.body, p.id).toContain("freeholdtc.dev");
    }
  });

  it("attaches only assets that exist", () => {
    for (const p of SOCIAL_POSTS) {
      if (p.suggestedAsset) expect(onDisk.has(p.suggestedAsset), p.suggestedAsset).toBe(true);
    }
  });
});

describe("the promises these posts make", () => {
  // These go out under Freehold's name. A number that drifts out of step with
  // the homepage is a support problem and a credibility problem at once.
  const all = SOCIAL_POSTS.map((p) => p.body)
    .join("\n")
    .toLowerCase();

  it("quotes one price, and it is the real one", () => {
    expect(all).toContain("$40");
    // No stray older price points from previous copy.
    expect(all).not.toContain("$99");
    expect(all).not.toContain("$29");
  });

  it("describes the free tier the way billing actually works", () => {
    expect(all).toContain("5 active closings");
    expect(all).toContain("no credit card");
    // It is a free plan, not a countdown.
    expect(all).not.toMatch(/\d+[- ]day free trial/);
    expect(all).not.toContain("trial expires");
  });

  it("states onboarding as 30 days, everywhere it comes up", () => {
    const mentions = SOCIAL_POSTS.filter((p) => /onboarding/i.test(p.body));
    expect(mentions.length).toBeGreaterThan(0);
    for (const p of mentions) expect(p.body, p.id).toMatch(/30 days/i);
  });

  it("does not promise anything the product doesn't do", () => {
    // Guard against the marketing-drift words that would have us claiming a
    // roadmap item as shipped.
    for (const word of ["coming soon", "beta", "waitlist", "unlimited storage"]) {
      expect(all, word).not.toContain(word);
    }
  });

  it("carries no em-dashes, matching the site's copy rule", () => {
    for (const p of SOCIAL_POSTS) {
      expect(p.body, p.id).not.toContain("—");
      expect(p.body, p.id).not.toContain("–");
    }
  });
});

describe("who is speaking", () => {
  const FIRST_PERSON_AUTHOR = [
    /\bi built\b/i,
    /\bi've built\b/i,
    /\bi made\b/i,
    /\bi've spent\b/i,
    /\bthe system i\b/i,
    /\bwhile building this\b/i,
    /\bi'm asking\b/i,
  ];

  it("never has a company post claim to have built the product", () => {
    // These get posted by a sales rep under the brand's name. A rep saying
    // "I built this" is the single thing that would make the whole account
    // read as fake, and it is an easy mistake to make when copy is edited.
    for (const p of SOCIAL_POSTS.filter((p) => p.voice === "company")) {
      for (const re of FIRST_PERSON_AUTHOR) {
        expect(re.test(p.body), `${p.id}: ${re}`).toBe(false);
      }
    }
  });

  it("keeps the founder posts personal, which is the point of them", () => {
    const founder = SOCIAL_POSTS.filter((p) => p.voice === "founder");
    const personal = founder.filter((p) => FIRST_PERSON_AUTHOR.some((re) => re.test(p.body)));
    expect(personal.length).toBeGreaterThan(0);
  });

  it("names the product in the company posts, since nobody knows it yet", () => {
    for (const p of SOCIAL_POSTS.filter((p) => p.voice === "company")) {
      expect(p.body, p.id).toMatch(/freehold/i);
    }
  });
});

describe("the asset manifest", () => {
  it("lists only files that are actually in public/marketing/social", () => {
    for (const g of ASSET_GROUPS) {
      for (const item of g.items) {
        expect(onDisk.has(item.file), `${g.title}: ${item.file}`).toBe(true);
      }
    }
  });

  it("does not list the same file twice", () => {
    const files = ASSET_GROUPS.flatMap((g) => g.items.map((i) => i.file));
    expect(new Set(files).size).toBe(files.length);
  });

  it("ships every screenshot that exists, so none is quietly forgotten", () => {
    const listed = new Set(ASSET_GROUPS.flatMap((g) => g.items.map((i) => i.file)));
    for (const f of topLevel) {
      if (f.startsWith("shot-")) expect(listed.has(f), f).toBe(true);
    }
  });
});

describe("the presenter prompts", () => {
  it("describe one character in enough detail to reproduce her", () => {
    // Consistency across images comes from the character paragraph being
    // identical every time, so it has to carry the specifics.
    for (const trait of ["hair", "skin", "blazer"]) {
      expect(PRESENTER_PROMPTS.character.toLowerCase()).toContain(trait);
    }
  });

  it("keeps the scene out of the character description", () => {
    // If the desk lives in the character paragraph, every shot is the same shot.
    expect(PRESENTER_PROMPTS.character.toLowerCase()).not.toContain("desk");
    expect(PRESENTER_PROMPTS.shots.length).toBeGreaterThanOrEqual(4);
  });
});
