import { describe, expect, it } from "vitest";
import { stripQuotedReply } from "./email-quote";

describe("stripQuotedReply", () => {
  it("keeps the new reply and cuts a Gmail 'On … wrote:' quote", () => {
    const raw = [
      "Tuesday at 2pm works for the inspection.",
      "",
      "On Tue, Jul 21, 2026 at 9:00 AM Maplewood <reply+abc@reply.freeholdtc.dev> wrote:",
      "> We'd like to order a home inspection for 88 Harbor Lane.",
      "> Please let us know your availability.",
    ].join("\n");
    expect(stripQuotedReply(raw)).toBe("Tuesday at 2pm works for the inspection.");
  });

  it("cuts an Outlook 'Original Message' block", () => {
    const raw = [
      "Confirmed, we'll be there Thursday.",
      "",
      "-----Original Message-----",
      "From: Maplewood Transactions",
      "Sent: Monday",
      "To: Summit Title",
    ].join("\n");
    expect(stripQuotedReply(raw)).toBe("Confirmed, we'll be there Thursday.");
  });

  it("cuts an Outlook From:/Sent:/To: header block", () => {
    const raw = [
      "Declined — we're booked that week.",
      "",
      "From: Maplewood <x@y.com>",
      "Sent: Monday, Jul 20",
      "To: summit@title.com",
      "Subject: Order",
    ].join("\n");
    expect(stripQuotedReply(raw)).toBe("Declined — we're booked that week.");
  });

  it("drops a trailing fully-quoted block with no header", () => {
    const raw = ["Sounds good.", "> original line one", "> original line two"].join("\n");
    expect(stripQuotedReply(raw)).toBe("Sounds good.");
  });

  it("drops a mobile signature", () => {
    const raw = "Yes that works.\n\nSent from my iPhone";
    expect(stripQuotedReply(raw)).toBe("Yes that works.");
  });

  it("normalizes CRLF and trims", () => {
    expect(stripQuotedReply("  hello there  \r\n")).toBe("hello there");
  });

  it("falls back to the whole text when there's no new content above the quote", () => {
    const raw = "On Tue, Jul 21, 2026 at 9:00 AM Someone wrote:\n> just the quote";
    // Nothing above the header → don't return empty; keep the original.
    expect(stripQuotedReply(raw).length).toBeGreaterThan(0);
  });
});
