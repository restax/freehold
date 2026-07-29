-- Per-person, per-workspace table preferences (the transactions column
-- picker, for now). On member rather than user: someone coordinating for
-- two workspaces wants different columns in each, the same way roles and
-- assignments already don't cross tenants.
--
-- Nullable with no default: unset means "use the defaults in code", so a
-- release that adds or removes a column changes what everyone sees without
-- a backfill.
ALTER TABLE "member" ADD COLUMN "table_prefs" JSONB;
