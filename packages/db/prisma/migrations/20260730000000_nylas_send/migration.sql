-- EmailThread's counterpart for the send-as-self path.
--
-- The Nylas webhook arrives with a message id and a thread id, nothing else
-- — no tenant context. `email` has RLS keyed off app.tenant_id, so a lookup
-- against it with no tenant set matches zero rows under the app role, not
-- everything. Same problem EmailThread already solves for the Resend path,
-- same fix: an unprotected side table, one row per Nylas send, looked up
-- before the tenant is known, so the actual reply can then be written
-- through the normal RLS-scoped path once it is.

CREATE TABLE "nylas_send" (
    "id"              TEXT NOT NULL,
    "tenant_id"       TEXT NOT NULL,
    "transaction_id"  TEXT,
    "contact_id"      TEXT,
    "provider_id"     TEXT NOT NULL,
    "nylas_thread_id" TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nylas_send_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nylas_send_provider_id_key" ON "nylas_send"("provider_id");
CREATE INDEX "nylas_send_nylas_thread_id_idx" ON "nylas_send"("nylas_thread_id");
