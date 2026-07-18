/**
 * Runs at the start of the Vercel build, where the marketplace Postgres
 * credentials (STORAGE_*) are injected. Idempotent:
 *
 *   1. Ensures the non-owner `freehold_app` role exists with the password
 *      from FREEHOLD_APP_DB_PASSWORD. The app must NOT connect as the table
 *      owner: owners bypass row-level security, which is the tenant wall.
 *   2. Runs `prisma migrate deploy` as the owner over the unpooled URL.
 *   3. Re-grants table/sequence privileges to freehold_app so tables from
 *      any migration are covered.
 *
 * Locally (no STORAGE_* vars) it exits without doing anything.
 */
import { spawnSync } from "node:child_process";
import pg from "pg";

const owner = process.env.STORAGE_DATABASE_URL_UNPOOLED;
const appPassword = process.env.FREEHOLD_APP_DB_PASSWORD;

if (!owner || !appPassword) {
  console.log("vercel-db-setup: STORAGE_DATABASE_URL_UNPOOLED or FREEHOLD_APP_DB_PASSWORD not set, skipping");
  process.exit(0);
}

const dbName = new URL(owner).pathname.replace(/^\//, "");
const quotedPassword = appPassword.replace(/'/g, "''");

const client = new pg.Client({ connectionString: owner });
await client.connect();

await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'freehold_app') THEN
      CREATE ROLE freehold_app LOGIN;
    END IF;
  END $$;
`);
await client.query(`ALTER ROLE freehold_app LOGIN PASSWORD '${quotedPassword}'`);
await client.query(`GRANT CONNECT ON DATABASE "${dbName}" TO freehold_app`);
await client.query(`GRANT USAGE ON SCHEMA public TO freehold_app`);
console.log("vercel-db-setup: freehold_app role ready");

const migrate = spawnSync(
  "pnpm",
  ["--filter", "@freehold/db", "exec", "prisma", "migrate", "deploy"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: owner } },
);
if (migrate.status !== 0) {
  await client.end();
  process.exit(migrate.status ?? 1);
}

await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO freehold_app`);
await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO freehold_app`);
await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO freehold_app`);
await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO freehold_app`);
await client.end();
console.log("vercel-db-setup: migrations deployed, grants applied");

// Prove the runtime path works: connect through the pooler as freehold_app,
// exactly the way packages/db derives its connection at runtime.
const pooled = process.env.STORAGE_DATABASE_URL;
if (pooled) {
  const url = new URL(pooled);
  url.username = "freehold_app";
  url.password = encodeURIComponent(appPassword);
  const probe = new pg.Client({ connectionString: url.toString() });
  try {
    await probe.connect();
    await probe.query("SELECT 1");
    console.log("vercel-db-setup: pooled freehold_app connection OK");
  } catch (err) {
    console.error(`vercel-db-setup: pooled freehold_app connection FAILED: ${err.message}`);
  } finally {
    await probe.end().catch(() => {});
  }
}
