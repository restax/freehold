/**
 * Throttling for the public homepage voice demo.
 *
 * Unlike every other voice surface, this one is open to the internet with no
 * login — and each session spends real money across three vendors (Deepgram,
 * Claude, ElevenLabs). Without a ceiling, one bored visitor with a reload key
 * drains the month's text-to-speech budget in an afternoon.
 *
 * Deliberately in-memory: no schema, no migration, no write on a hot public
 * path. The tradeoff is honest — serverless runs many instances, so the real
 * ceiling is roughly (limit × instances), and a determined abuser spread across
 * instances gets more than one instance's share. It stops casual hammering,
 * which is the actual failure mode here. If the demo ever gets real traffic,
 * move these counters to Redis or the database and treat this as the stopgap
 * it is.
 */

const DAILY_MAX = Number(process.env.FREEHOLD_VOICE_DEMO_DAILY_MAX ?? 40);
const PER_IP_COOLDOWN_MS = 5 * 60 * 1000;

let dayKey = "";
let dayCount = 0;
const lastByIp = new Map<string, number>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Best-effort client identity; proxies vary, so this is a hint not an identity. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export type DemoLimit = { ok: true } | { ok: false; reason: "daily_cap" | "cooldown" };

export function checkDemoLimit(ip: string): DemoLimit {
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

  // Keep the map from growing without bound on a public endpoint.
  if (lastByIp.size > 5000) lastByIp.clear();

  lastByIp.set(ip, now);
  dayCount += 1;
  return { ok: true };
}
