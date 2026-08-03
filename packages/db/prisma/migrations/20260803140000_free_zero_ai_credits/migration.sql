-- Free carries no included AI credits anymore. Only the column default
-- changes — existing workspaces' balances are untouched, this affects new
-- workspaces only.

ALTER TABLE "organization"
  ALTER COLUMN "ai_credits" SET DEFAULT 0;
