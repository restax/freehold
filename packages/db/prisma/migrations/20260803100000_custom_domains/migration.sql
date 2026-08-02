-- Custom domains: a workspace can serve its public surface from a hostname it
-- owns (www.smithtc.com) instead of only <slug>.freeholdtc.dev.
--
-- Unique on the domain because a hostname resolves to exactly one workspace.
-- That constraint is the anti-squatting mechanism as much as it is a data
-- rule: two workspaces cannot both claim a name, and the row only starts
-- serving once status flips to 'active' (i.e. the domain provider confirmed
-- the DNS actually points at us).

ALTER TABLE "organization"
  ADD COLUMN "custom_domain" TEXT,
  ADD COLUMN "custom_domain_status" TEXT,
  ADD COLUMN "custom_domain_note" TEXT;

CREATE UNIQUE INDEX "organization_custom_domain_key" ON "organization"("custom_domain");
