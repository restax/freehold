#!/usr/bin/env node
// Regenerates the dashboard's "System Updates" panel from real commit history —
// see apps/web/src/components/hub-news.tsx.
//
// Every commit can end its message with a `Changelog: <one-line sentence>`
// trailer (same idea as the existing `Co-Authored-By:` trailer). This script
// pulls the most recent ones straight from `git log`, so the panel can never
// go stale the way a hand-maintained array in a component file did — nobody
// has to remember a second place to write the update.
//
// Runs as part of `pnpm build` in apps/web — but that build-time run is a
// no-op in production. This project deploys via `vercel --prod` from a local
// checkout, not a GitHub-integrated build, so Vercel's build sandbox has no
// `.git` directory at all (confirmed: "fatal: not a git repository", not a
// shallow-clone truncation as originally assumed here). The safe-no-op
// fallback below still matters for that reason, just not the one first
// written — it's what makes "no git history available" leave the
// already-committed JSON alone instead of blanking the panel.
//
// **So this has to be run locally and its output committed**, same commit as
// the `Changelog:` trailer that's meant to show up: `node
// scripts/generate-changelog.mjs`, then `git add
// apps/web/src/content/changelog.json`. The build-time run only helps on a
// deploy setup that actually gives Vercel real git history (a GitHub-
// integrated build) — worth revisiting if this project ever switches to one.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(REPO_ROOT, "apps/web/src/content/changelog.json");
const MAX_ITEMS = 6;
const MIN_HISTORY_DEPTH = 20;
const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

function run(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8" });
}

function main() {
  const depth = Number(run("git rev-list --count HEAD").trim());
  if (!Number.isFinite(depth) || depth < MIN_HISTORY_DEPTH) {
    console.log(
      `changelog: shallow checkout (${depth} commits available) — keeping the committed file as-is`,
    );
    return;
  }

  const raw = run(`git log --format=${RECORD_SEP}%ad${FIELD_SEP}%B --date=format:%Y-%m-%d`);

  const items = [];
  for (const record of raw.split(RECORD_SEP)) {
    if (!record.trim()) continue;
    const sepIndex = record.indexOf(FIELD_SEP);
    if (sepIndex === -1) continue;
    const date = record.slice(0, sepIndex);
    const body = record.slice(sepIndex + 1);
    const match = body.match(/^Changelog:\s*(.+)$/m);
    if (!match) continue;
    items.push({ date, text: match[1].trim() });
    if (items.length >= MAX_ITEMS) break;
  }

  if (items.length === 0) {
    console.log(
      "changelog: no commits with a 'Changelog:' trailer found — keeping the committed file as-is",
    );
    return;
  }

  writeFileSync(OUT_FILE, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`changelog: wrote ${items.length} item(s) from git history`);
}

try {
  main();
} catch (err) {
  console.log(`changelog: skipped (${err instanceof Error ? err.message : String(err)})`);
}
