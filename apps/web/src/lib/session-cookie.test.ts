import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "./session-cookie";

describe("hasSessionCookie", () => {
  it("matches the development cookie", () => {
    expect(hasSessionCookie(["better-auth.session_token"])).toBe(true);
  });

  it("matches the __Secure- prefixed cookie set over HTTPS", () => {
    expect(hasSessionCookie(["__Secure-better-auth.session_token"])).toBe(true);
  });

  it("matches a self-hosted install's custom cookiePrefix", () => {
    expect(hasSessionCookie(["acme.session_token"])).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    expect(hasSessionCookie(["tcb-theme", "__vercel_live_token"])).toBe(false);
  });

  it("is false with no cookies at all — the crawler's case", () => {
    expect(hasSessionCookie([])).toBe(false);
  });

  it("does not match the session data cookie, which is not proof of a session", () => {
    expect(hasSessionCookie(["better-auth.session_data"])).toBe(false);
  });
});
