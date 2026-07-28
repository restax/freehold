-- The post-close review ask: one row per file per ask.
--
-- A row is both "we asked" (sentAt, token, expiresAt) and "here is what
-- they said" (the rating/comment columns, null until answered) — the row's
-- own existence via the unique transaction_id is what stops a file being
-- asked twice. The token is the same expiring-capability pattern as
-- form_access_link: no session, no read access beyond this one ask.

CREATE TABLE "client_review" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "coordinator_id" TEXT,
    "coordinator_name" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "business_rating" INTEGER,
    "coordinator_rating" INTEGER,
    "comment" TEXT,
    "publish_allowed" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_review_transaction_id_key" ON "client_review"("transaction_id");
CREATE UNIQUE INDEX "client_review_token_key" ON "client_review"("token");
CREATE INDEX "client_review_tenant_id_answered_at_idx" ON "client_review"("tenant_id", "answered_at");
CREATE INDEX "client_review_tenant_id_coordinator_id_idx" ON "client_review"("tenant_id", "coordinator_id");

ALTER TABLE "client_review" ADD CONSTRAINT "client_review_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_review" ADD CONSTRAINT "client_review_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_review" ADD CONSTRAINT "client_review_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_review" ADD CONSTRAINT "client_review_coordinator_id_fkey"
  FOREIGN KEY ("coordinator_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_review" ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_review_tenant_isolation ON "client_review"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_review" TO freehold_app;
