import { createHash, randomBytes } from "node:crypto";

/**
 * The address a request came from, behind whatever proxy fronts us. The first
 * x-forwarded-for hop is the client; Vercel sets it. Null when nothing usable
 * is there, never the string "unknown", so a missing address can't look like
 * a shared one in the operator panel.
 */
export function clientIp(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : null;
}

/** A fresh emailed-link token. Only the hash is stored. */
export function newFlagToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashFlagToken(token) };
}

export function hashFlagToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function flagEmailCopy(input: { name: string; verifyUrl: string }): {
  subject: string;
  text: string;
} {
  return {
    subject: "Your Freehold account needs a quick check",
    text: [
      `Hi ${input.name},`,
      "",
      "Your Freehold account has been flagged as suspicious, and sign-in is paused until we can confirm it is you. Nothing in your account has been deleted.",
      "",
      "You can get back in either way:",
      "",
      `1. Verify a credit card. You will not be charged. This takes about a minute:\n${input.verifyUrl}`,
      "",
      "2. Reply to this email and tell us a little about how you plan to use Freehold.",
      "",
      "Once the card is verified, or we have read your reply and cleared the account, you can sign in as normal.",
      "",
      "The Freehold team",
    ].join("\n"),
  };
}
