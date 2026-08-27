/**
 * Caps the local Turborepo cache at a size budget, oldest build first.
 *
 * Turborepo has no cache eviction of its own: every distinct task hash writes
 * a fresh tarball into `.turbo/cache` and nothing ever removes one. Each
 * cached web build here is roughly a third of a gigabyte, so a fortnight of
 * ordinary work grew the directory to 23 GB and filled the disk.
 *
 * One cached task is three files sharing a hash prefix — `<hash>.tar.zst`
 * plus `<hash>-meta.json` and `<hash>-manifest.json`. They are deleted as a
 * group: a tarball whose metadata is missing is not a cache hit, it is
 * 300 MB that can never be read again.
 *
 * Runs as `postbuild`, so the cache is trimmed at the one moment it grows,
 * and exits silently when already under budget (the normal case). Nothing
 * here can break a build: the cache is disposable by definition, and the
 * worst case of over-deleting is a slower next build.
 *
 *   node scripts/trim-turbo-cache.mjs [--budget-mb 5000] [--dir path] [--dry-run]
 *
 * TURBO_CACHE_BUDGET_MB overrides the default budget.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_BUDGET_MB = 5000;
const MB = 1024 * 1024;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const cacheDir = arg("dir", join(process.cwd(), ".turbo", "cache"));
const budgetBytes =
  Number(arg("budget-mb", process.env.TURBO_CACHE_BUDGET_MB ?? DEFAULT_BUDGET_MB)) * MB;

if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) {
  console.error(`trim-turbo-cache: bad budget ${arg("budget-mb", "")}`);
  process.exit(1);
}

let names;
try {
  names = readdirSync(cacheDir);
} catch {
  // No cache yet (fresh clone, or CI), which is nothing to trim.
  process.exit(0);
}

/** Group every file under the task hash it belongs to. */
const entries = new Map();
for (const name of names) {
  // `<hash>.tar.zst`, `<hash>-meta.json`, `<hash>-manifest.json`.
  const hash = name.replace(/(-meta\.json|-manifest\.json|\.tar\.zst)$/, "");
  let stat;
  try {
    stat = statSync(join(cacheDir, name));
  } catch {
    continue; // Vanished under us; a concurrent turbo run is allowed to do that.
  }
  if (!stat.isFile()) continue;
  const entry = entries.get(hash) ?? { hash, files: [], bytes: 0, mtime: 0 };
  entry.files.push(name);
  entry.bytes += stat.size;
  // An entry is as recent as its newest file: reading a cache hit does not
  // touch mtime, but rewriting one does, so the newest file is the honest age.
  entry.mtime = Math.max(entry.mtime, stat.mtimeMs);
  entries.set(hash, entry);
}

const total = [...entries.values()].reduce((sum, e) => sum + e.bytes, 0);
if (total <= budgetBytes) process.exit(0);

// Oldest first, so the builds most likely to still be hit are the survivors.
const byAge = [...entries.values()].sort((a, b) => a.mtime - b.mtime);

let freed = 0;
let removed = 0;
for (const entry of byAge) {
  if (total - freed <= budgetBytes) break;
  if (!dryRun) {
    for (const file of entry.files) rmSync(join(cacheDir, file), { force: true });
  }
  freed += entry.bytes;
  removed += 1;
}

const gb = (bytes) => `${(bytes / 1024 / MB).toFixed(1)} GB`;
console.log(
  `trim-turbo-cache: ${dryRun ? "would remove" : "removed"} ${removed} cached ` +
    `build${removed === 1 ? "" : "s"} (${gb(freed)}), ${gb(total - freed)} of ` +
    `${gb(budgetBytes)} budget remaining in ${entries.size - removed} entries.`,
);
