import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPlatformEmail } from "./platform-email";

describe("sendPlatformEmail", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM_DOMAIN", "example.test");
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("sends attachments as base64 under the name given", async () => {
    await sendPlatformEmail("a@b.test", "Re: Help", "text", "<p>html</p>", [
      { filename: "Screenshot 1.png", content: Buffer.from("hello") },
    ]);
    expect(sentBody().attachments).toEqual([
      { filename: "Screenshot 1.png", content: Buffer.from("hello").toString("base64") },
    ]);
  });

  it("leaves the attachments field out when there are none", async () => {
    await sendPlatformEmail("a@b.test", "Subject", "text");
    expect(sentBody()).not.toHaveProperty("attachments");
    await sendPlatformEmail("a@b.test", "Subject", "text", undefined, []);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).not.toHaveProperty("attachments");
  });

  it("throws when the mail service refuses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
    await expect(sendPlatformEmail("a@b.test", "S", "t")).rejects.toThrow("422");
  });
});
