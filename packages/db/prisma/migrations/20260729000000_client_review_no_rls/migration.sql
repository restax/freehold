-- client_review is looked up by its bare token before the tenant is known,
-- the same shape as portal_link — not form_access_link, which is always
-- resolved after the tenant is known from a URL slug. RLS on a
-- tenant-unaware first lookup just makes that first query return nothing,
-- which is the bug this migration fixes rather than a security feature:
-- the token itself (24 random bytes) is the authorization, and every read
-- or write after the lookup still goes through withTenant(review.tenantId).
ALTER TABLE "client_review" DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_review_tenant_isolation ON "client_review";
