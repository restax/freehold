-- The clients' Claude connector, part one: the switches, the grant, and the
-- two tables the later stages fill in.
--
-- Nothing here connects anything. This migration only makes it possible for a
-- coordinator to say "this client's assistant may read their own files" and
-- for that answer to have somewhere to live.

-- How much one client's own Claude may do. NONE is the default and means the
-- feature does not exist for them: no connection can be offered, let alone
-- bind. APPROVE is the middle rung with no member equivalent — the assistant
-- may ask, and the asking never changes a record.
CREATE TYPE "ClientConnectorLevel" AS ENUM ('NONE', 'READ', 'APPROVE', 'FULL');
CREATE TYPE "ClientConnectorRequestKind" AS ENUM ('TASK', 'NEW_TRANSACTION');
CREATE TYPE "ClientConnectorRequestStatus" AS ENUM ('NEW', 'APPROVED', 'DECLINED');

-- The subscriber's master switch for the client-facing connector. Deliberately
-- not the existing mcp_enabled: that flag promises the subscriber "off
-- disconnects everyone immediately", and the everyone it means is their staff.
ALTER TABLE "organization"
  ADD COLUMN "client_connector_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "client"
  ADD COLUMN "connector_level" "ClientConnectorLevel" NOT NULL DEFAULT 'NONE';

-- Provenance that survives an edit and can be queried, rather than the
-- "(via Claude)" suffix convention the activity trail uses for display.
ALTER TABLE "task" ADD COLUMN "source" TEXT;

-- Lightweight accounts that exist only to hold a client connection. Checked
-- by the surfaces that assume a coordinator, rather than inferring from "has
-- no workspaces", which is also true of a real coordinator's first morning.
ALTER TABLE "user"
  ADD COLUMN "is_client_identity" BOOLEAN NOT NULL DEFAULT false;

-- One client's live connection.
--
-- No row-level security here, the same deliberate exemption api_key,
-- portal_link and mcp_connection carry: resolving this row is what establishes
-- the tenant, so it has to be readable before any tenant context exists. Every
-- read is keyed on the user id the bearer token proved, and the tenant named
-- here scopes everything downstream.
CREATE TABLE "client_connector_connection" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "oauth_client_id" TEXT NOT NULL,
  "oauth_client_name" TEXT NOT NULL,
  "bound_email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "client_connector_connection_pkey" PRIMARY KEY ("id")
);

-- One binding per (person, connected app), matching mcp_connection. A token
-- that answered for two tenants would make every zero-parameter tool ambiguous
-- about whose files it meant.
CREATE UNIQUE INDEX "client_connector_connection_user_id_oauth_client_id_key"
  ON "client_connector_connection"("user_id", "oauth_client_id");
CREATE INDEX "client_connector_connection_tenant_id_idx"
  ON "client_connector_connection"("tenant_id");
CREATE INDEX "client_connector_connection_tenant_id_client_id_idx"
  ON "client_connector_connection"("tenant_id", "client_id");

ALTER TABLE "client_connector_connection"
  ADD CONSTRAINT "client_connector_connection_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_connection"
  ADD CONSTRAINT "client_connector_connection_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_connection"
  ADD CONSTRAINT "client_connector_connection_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "client_connector_connection" TO freehold_app;

-- What a client asked for, waiting on a coordinator.
--
-- Its own table rather than a task with a flag: an unreviewed request is not
-- work, and task rows default to visible in both portals, so an ask would echo
-- straight back to the person who made it looking already scheduled.
CREATE TABLE "client_connector_request" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "connection_id" TEXT,
  "kind" "ClientConnectorRequestKind" NOT NULL,
  "payload" JSONB NOT NULL,
  "transaction_id" TEXT,
  "status" "ClientConnectorRequestStatus" NOT NULL DEFAULT 'NEW',
  "resolution_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_id" TEXT,
  "created_task_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_connector_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_connector_request_tenant_id_status_idx"
  ON "client_connector_request"("tenant_id", "status");
CREATE INDEX "client_connector_request_tenant_id_client_id_idx"
  ON "client_connector_request"("tenant_id", "client_id");
CREATE INDEX "client_connector_request_transaction_id_idx"
  ON "client_connector_request"("transaction_id");

ALTER TABLE "client_connector_request"
  ADD CONSTRAINT "client_connector_request_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_request"
  ADD CONSTRAINT "client_connector_request_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
-- SetNull, not Cascade: a request outlives the connection that made it, the
-- same way a statement outlives the assignment behind it.
ALTER TABLE "client_connector_request"
  ADD CONSTRAINT "client_connector_request_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "client_connector_connection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_connector_request"
  ADD CONSTRAINT "client_connector_request_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_request"
  ADD CONSTRAINT "client_connector_request_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unlike the connection table above, requests are only ever read once the
-- tenant is already known, so they get the ordinary isolation every
-- tenant-owned table has — WITH CHECK pinned to the inserting side so a tenant
-- can't write rows naming another tenant.
ALTER TABLE "client_connector_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_connector_request" FORCE ROW LEVEL SECURITY;
CREATE POLICY client_connector_request_tenant_isolation ON "client_connector_request"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_connector_request" TO freehold_app;
