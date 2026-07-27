-- Identified intake: a scoped, expiring capability to fill one form as one
-- known client, plus the counter that makes the "is this you?" check safe to
-- answer honestly.
--
--   * form_access_link is NOT a login. It carries no session and grants no
--     read access — only "open this form pre-filled". Two-factor auth on the
--     real account is untouched, and a forwarded link can at worst queue a
--     submission a person still reviews. Unlike portal_link, it expires.
--   * form_lookup_attempt exists so email probing can be rate-limited
--     whatever the answer. Without counting the misses, an attacker learns a
--     client list by asking only about addresses that aren't there.

CREATE TABLE "form_access_link" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_access_link_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_access_link_token_key" ON "form_access_link"("token");
CREATE INDEX "form_access_link_tenant_id_form_id_idx" ON "form_access_link"("tenant_id", "form_id");

ALTER TABLE "form_access_link" ADD CONSTRAINT "form_access_link_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_access_link" ADD CONSTRAINT "form_access_link_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_access_link" ADD CONSTRAINT "form_access_link_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "form_lookup_attempt" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_lookup_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_lookup_attempt_tenant_id_ip_hash_createdAt_idx"
  ON "form_lookup_attempt"("tenant_id", "ip_hash", "createdAt");

ALTER TABLE "form_lookup_attempt" ADD CONSTRAINT "form_lookup_attempt_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_access_link" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_access_link_tenant_isolation ON "form_access_link"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_access_link" TO freehold_app;

ALTER TABLE "form_lookup_attempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_lookup_attempt_tenant_isolation ON "form_lookup_attempt"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_lookup_attempt" TO freehold_app;
