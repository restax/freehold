import { describe, expect, it } from "vitest";
import {
  groupByDay,
  isOfferedSlot,
  offeredSlots,
  sessionIcs,
  setupOfferEmail,
  slotFullLabel,
  slotTimeToDate,
} from "./setup-sessions";

// Monday 2026-10-12, noon UTC.
const NOW = new Date("2026-10-12T16:00:00Z");

describe("slotTimeToDate", () => {
  it("uses daylight time in October", () => {
    expect(slotTimeToDate(2026, 10, 20, 10, 0).toISOString()).toBe("2026-10-20T14:00:00.000Z");
  });
  it("uses standard time in December", () => {
    expect(slotTimeToDate(2026, 12, 8, 10, 0).toISOString()).toBe("2026-12-08T15:00:00.000Z");
  });
});

describe("offeredSlots", () => {
  const slots = offeredSlots(NOW);
  it("only offers Tuesday to Thursday, at the four times", () => {
    for (const s of slots) {
      const label = slotFullLabel(s);
      expect(label).toMatch(/^(Tuesday|Wednesday|Thursday)/);
      expect(label).toMatch(/(7:00 AM|10:00 AM|1:00 PM|7:00 PM) Eastern$/);
    }
  });
  it("keeps a lead time and sorts soonest first", () => {
    expect(slots[0]?.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 36 * 3600 * 1000);
    expect([...slots].sort((a, b) => a.getTime() - b.getTime())).toEqual(slots);
  });
  it("recognises its own slots and rejects others", () => {
    expect(isOfferedSlot(slots[0] as Date, NOW)).toBe(true);
    expect(isOfferedSlot(new Date("2026-10-20T14:07:00Z"), NOW)).toBe(false);
  });
});

describe("setupOfferEmail", () => {
  const mail = setupOfferEmail({
    name: "Alex Reyes",
    pageUrl: "https://freeholdtc.dev/setup/tok",
    slots: offeredSlots(NOW),
  });
  it("greets by first name and links every time to the booking page", () => {
    expect(mail.text).toContain("Hi Alex,");
    expect(mail.html).toContain("https://freeholdtc.dev/setup/tok?at=");
  });
  it("avoids em dashes and the retired-broker line", () => {
    for (const body of [mail.text, mail.html]) {
      expect(body).not.toContain("—");
      expect(body).not.toMatch(/Retired|30 years/);
    }
  });
  it("groups into at most three days", () => {
    expect(groupByDay(offeredSlots(NOW)).length).toBeGreaterThan(3);
  });
});

describe("sessionIcs", () => {
  it("writes a 30 minute timed event", () => {
    const ics = sessionIcs({ id: "x", startsAt: new Date("2026-10-20T14:00:00Z"), name: "A" });
    expect(ics).toContain("DTSTART:20261020T140000Z");
    expect(ics).toContain("DTEND:20261020T143000Z");
  });
});
