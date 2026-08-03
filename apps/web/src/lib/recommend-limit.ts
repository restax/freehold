/**
 * Throttling for the public "recommend Freehold" send on /recommend.
 *
 * Open to the internet with no login, and it emails an address the visitor
 * typed in themselves — the classic "arbitrary email relay" shape. Same
 * stopgap as voice-demo-limit.ts: in-memory, no schema, no write on a hot
 * public path. Stops casual abuse (someone hammering the form to spam one
 * address, or blasting many); it does not stop a determined attacker spread
 * across serverless instances. If this ever needs to be airtight, move the
 * counters to the database and treat this as the interim version.
 */

const DAILY_MAX = Number(process.env.FREEHOLD_RECOMMEND_DAILY_MAX ?? 100);
const PER_IP_COOLDOWN_MS = 60 * 1000;

let dayKey = "";
let dayCount = 0;
const lastByIp = new Map<string, number>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type RecommendLimit = { ok: true } | { ok: false; reason: "daily_cap" | "cooldown" };

export function checkRecommendLimit(ip: string): RecommendLimit {
  const now = Date.now();

  if (dayKey !== today()) {
    dayKey = today();
    dayCount = 0;
    lastByIp.clear();
  }
  if (dayCount >= DAILY_MAX) return { ok: false, reason: "daily_cap" };

  const last = lastByIp.get(ip);
  if (last != null && now - last < PER_IP_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown" };
  }

  if (lastByIp.size > 5000) lastByIp.clear();

  lastByIp.set(ip, now);
  dayCount += 1;
  return { ok: true };
}
