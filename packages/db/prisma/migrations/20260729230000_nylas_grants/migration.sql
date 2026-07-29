-- A TC's own inbox, connected via Nylas so they can send as themselves
-- instead of the workspace's shared Resend address.
--
-- Person-scoped like account/session, not tenant-scoped: a TC's connected
-- Gmail follows them across every workspace they belong to. No tenant_id,
-- so no RLS — same reasoning as those two tables.

CREATE TABLE "nylas_grant" (
    "id"           TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "grant_id"     TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "provider"     TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'valid',
    "last_error"   TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nylas_grant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nylas_grant_user_id_key" ON "nylas_grant"("user_id");
CREATE UNIQUE INDEX "nylas_grant_grant_id_key" ON "nylas_grant"("grant_id");

ALTER TABLE "nylas_grant" ADD CONSTRAINT "nylas_grant_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
