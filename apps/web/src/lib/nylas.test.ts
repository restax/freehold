import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildNylasAuthUrl,
  NYLAS_SCHEDULE_MAX_MS,
  NYLAS_SCHEDULE_MIN_MS,
  nylasEnabled,
  parseParties,
  scheduleFitsNylas,
  verifyNylasWebhook,
} from "./nylas";

const ENV_KEYS = [
  "NYLAS_CLIENT_ID",
  "NYLAS_API_KEY",
  "NYLAS_WEBHOOK_SECRET",
  "NYLAS_API_HOST",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("nylasEnabled", () => {
  it("needs both the client id and the api key", () => {
    process.env.NYLAS_CLIENT_ID = "id";
    delete process.env.NYLAS_API_KEY;
    expect(nylasEnabled()).toBe(false);

    process.env.NYLAS_API_KEY = "key";
    expect(nylasEnabled()).toBe(true);
  });
});

describe("buildNylasAuthUrl", () => {
  beforeEach(() => {
    process.env.NYLAS_CLIENT_ID = "client-123";
    delete process.env.NYLAS_API_HOST;
  });

  it("builds against the US host by default", () => {
    const url = new URL(buildNylasAuthUrl({ redirectUri: "https://app.test/cb", state: "abc" }));
    expect(url.origin).toBe("https://api.us.nylas.com");
    expect(url.pathname).toBe("/v3/connect/auth");
  });

  it("carries the parameters Nylas requires", () => {
    const url = new URL(buildNylasAuthUrl({ redirectUri: "https://app.test/cb", state: "abc" }));
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("omits provider so Nylas shows its own picker", () => {
    // Pinning a provider here would mean maintaining a list and guessing from
    // the address domain; letting Nylas ask covers Gmail/Outlook/IMAP alike.
    const url = new URL(buildNylasAuthUrl({ redirectUri: "https://app.test/cb", state: "abc" }));
    expect(url.searchParams.has("provider")).toBe(false);
  });

  it("honours a region host override without doubling the slash", () => {
    process.env.NYLAS_API_HOST = "https://api.eu.nylas.com/";
    const url = buildNylasAuthUrl({ redirectUri: "https://app.test/cb", state: "abc" });
    expect(url.startsWith("https://api.eu.nylas.com/v3/connect/auth?")).toBe(true);
  });

  it("escapes a redirect URI carrying its own query", () => {
    const url = new URL(
      buildNylasAuthUrl({
        redirectUri: "https://app.test/cb?next=/dashboard/profile",
        state: "s",
      }),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.test/cb?next=/dashboard/profile",
    );
  });
});

describe("scheduleFitsNylas", () => {
  const now = new Date("2026-07-29T12:00:00Z");
  const at = (ms: number) => new Date(now.getTime() + ms);

  it("takes a send comfortably inside the window", () => {
    expect(scheduleFitsNylas(at(60 * 60 * 1000), now)).toBe(true);
    expect(scheduleFitsNylas(at(7 * 24 * 60 * 60 * 1000), now)).toBe(true);
  });

  it("refuses a send too close to now", () => {
    // Under Nylas's floor it rejects the schedule outright, so these have to
    // fall through to our own outbox rather than being handed over.
    expect(scheduleFitsNylas(at(NYLAS_SCHEDULE_MIN_MS - 1000), now)).toBe(false);
    expect(scheduleFitsNylas(at(30 * 1000), now)).toBe(false);
  });

  it("refuses a send past thirty days", () => {
    expect(scheduleFitsNylas(at(NYLAS_SCHEDULE_MAX_MS + 1000), now)).toBe(false);
    expect(scheduleFitsNylas(at(60 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });

  it("accepts exactly on each boundary", () => {
    expect(scheduleFitsNylas(at(NYLAS_SCHEDULE_MIN_MS), now)).toBe(true);
    expect(scheduleFitsNylas(at(NYLAS_SCHEDULE_MAX_MS), now)).toBe(true);
  });

  it("refuses a time already past", () => {
    expect(scheduleFitsNylas(at(-60 * 1000), now)).toBe(false);
  });
});

describe("parseParties", () => {
  it("reads name and email off a normal party list", () => {
    expect(parseParties([{ name: "Sam Rivera", email: "sam@example.com" }])).toEqual([
      { name: "Sam Rivera", email: "sam@example.com" },
    ]);
  });

  it("defaults a missing name to empty rather than dropping the party", () => {
    // A bare address with no display name is common and still a real
    // recipient — losing it would misrepresent who the message went to.
    expect(parseParties([{ email: "sam@example.com" }])).toEqual([
      { name: "", email: "sam@example.com" },
    ]);
  });

  it("defaults a missing email to empty rather than throwing", () => {
    expect(parseParties([{ name: "Sam" }])).toEqual([{ name: "Sam", email: "" }]);
  });

  it("is safe on non-array input", () => {
    for (const bad of [undefined, null, "sam@example.com", {}, 42]) {
      expect(parseParties(bad)).toEqual([]);
    }
  });

  it("is safe on a null entry inside the array", () => {
    expect(parseParties([null, { email: "sam@example.com" }])).toEqual([
      { name: "", email: "" },
      { name: "", email: "sam@example.com" },
    ]);
  });
});

describe("verifyNylasWebhook", () => {
  const secret = "whsec-test-secret";
  const payload = JSON.stringify({ type: "message.created", data: { id: "m1" } });
  const good = createHmac("sha256", secret).update(payload).digest("hex");

  beforeEach(() => {
    process.env.NYLAS_WEBHOOK_SECRET = secret;
  });

  it("accepts a correct signature", () => {
    expect(verifyNylasWebhook(payload, good)).toBe(true);
  });

  it("accepts an uppercase hex signature", () => {
    expect(verifyNylasWebhook(payload, good.toUpperCase())).toBe(true);
  });

  it("rejects a signature for different content", () => {
    // The whole point: a tampered body must not verify.
    expect(verifyNylasWebhook(`${payload} `, good)).toBe(false);
  });

  it("rejects a wrong-length signature without throwing", () => {
    // timingSafeEqual throws on length mismatch — the guard has to come first.
    expect(verifyNylasWebhook(payload, "abc123")).toBe(false);
  });

  it("rejects when the secret is unset", () => {
    delete process.env.NYLAS_WEBHOOK_SECRET;
    expect(verifyNylasWebhook(payload, good)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyNylasWebhook(payload, null)).toBe(false);
  });
});
