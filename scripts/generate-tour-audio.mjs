/**
 * Turns the demo tour's narration into the static audio the tour plays.
 *
 *   node --experimental-strip-types scripts/generate-tour-audio.mjs
 *   node --experimental-strip-types scripts/generate-tour-audio.mjs --dry-run
 *
 * Writes apps/web/public/tour/<stop id>.mp3, one per stop, using the same
 * ElevenLabs voice the product's voice search speaks with, so the tour and
 * the product sound like the same person.
 *
 * Why pre-generated rather than a call per visitor: /demo is public and
 * unauthenticated, and a full tour is thirty-odd clips. Synthesising per
 * visit would hang a metered, per-request vendor spend off an open endpoint,
 * which is the exact problem lib/voice-demo-limit.ts already exists to
 * contain for a single homepage clip. Static files cost nothing to serve,
 * start instantly, and cannot be run up as a bill by a bored visitor.
 *
 * Idempotent: a manifest records the hash of the text (plus voice and model)
 * behind every clip, so a re-run only spends money on lines that actually
 * changed. Editing one word regenerates one file.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "apps/web/public/tour");
const MANIFEST = join(OUT_DIR, "manifest.json");

// Matches services/voice-agent/agent.py, so the tour is the same voice as the
// assistant a visitor can talk to two minutes later.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "YY7fzZmDizFQQv8XPAIY";
const MODEL = "eleven_turbo_v2_5";

const dryRun = process.argv.includes("--dry-run");

/** Reads .env without a dependency; the repo keeps real keys out of the shell. */
async function envFromDotfile(key) {
  if (process.env[key]) return process.env[key];
  try {
    const raw = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env: fall through to the error below */
  }
  return null;
}

async function main() {
  const { TOUR_STOPS } = await import("../apps/web/src/lib/demo-tour.ts");

  const apiKey = await envFromDotfile("ELEVENLABS_API_KEY");
  if (!apiKey && !dryRun) {
    console.error("ELEVENLABS_API_KEY is not set (checked the environment and .env).");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};

  let made = 0;
  let skipped = 0;
  for (const stop of TOUR_STOPS) {
    const hash = createHash("sha256")
      .update(`${VOICE_ID}\n${MODEL}\n${stop.narration}`)
      .digest("hex")
      .slice(0, 16);
    const file = join(OUT_DIR, `${stop.id}.mp3`);

    if (manifest[stop.id] === hash && existsSync(file)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`would generate ${stop.id} (${stop.narration.split(/\s+/).length} words)`);
      made++;
      continue;
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        text: stop.narration,
        model_id: MODEL,
        // Slightly steadier than the conversational default: this is read
        // copy, and stability keeps thirty clips sounding like one take.
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.0 },
      }),
    });
    if (!res.ok) {
      console.error(`${stop.id}: ElevenLabs returned ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    manifest[stop.id] = hash;
    made++;
    console.log(`wrote ${stop.id}.mp3`);
  }

  // Drop clips for stops that no longer exist, so the manifest stays honest.
  for (const id of Object.keys(manifest)) {
    if (!TOUR_STOPS.some((s) => s.id === id)) delete manifest[id];
  }
  if (!dryRun) await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\n${made} generated, ${skipped} unchanged, ${TOUR_STOPS.length} stops total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
