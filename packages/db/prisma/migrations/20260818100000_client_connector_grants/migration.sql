-- The clients' Claude connector, part two: how an outside agent becomes
-- someone the connector will answer for.
--
-- The problem this solves is a consequence of tenant isolation working. The
-- OAuth flow starts inside Claude and lands on our consent screen knowing
-- only who the person is. Answering "and which of our clients are they?"
-- would mean searching every workspace's clients by email — and `client`
-- carries forced row-level security precisely so that no query can do that.
-- Weakening it so this feature could ask is the wrong trade by a wide margin.
--
-- So the coordinator's side records the answer in advance. An agent opens the
-- portal they already have, proves they hold the address on their client
-- record, and that redemption writes the row below. By the time Claude sends
-- them to consent, "which client is this" is a primary-key lookup rather than
-- a search.

-- One person's proven claim on one client record.
--
-- No row-level security, the same deliberate exemption api_key, portal_link,
-- mcp_connection and client_connector_connection carry: reading this row is
-- what establishes the tenant, so it has to be readable before any tenant
-- context exists. Every read is keyed on the user id an authenticated session
-- proved, and the tenant named here scopes everything downstream.
CREATE TABLE "client_connector_grant" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  -- The address the claim was proved against, kept rather than inferred.
  -- Consent re-checks it against the client record's current email, so a
  -- coordinator correcting that field to a different agent's address retires
  -- the old grant without anyone having to remember this table exists.
  "bound_email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_connector_grant_pkey" PRIMARY KEY ("id")
);

-- One claim per (person, client). Re-proving the same address updates the row
-- rather than accumulating one per attempt, and a person who is a client of
-- two workspaces gets two rows, which is correct: they are two separate
-- grants made by two different subscribers.
CREATE UNIQUE INDEX "client_connector_grant_user_id_client_id_key"
  ON "client_connector_grant"("user_id", "client_id");
CREATE INDEX "client_connector_grant_tenant_id_client_id_idx"
  ON "client_connector_grant"("tenant_id", "client_id");

ALTER TABLE "client_connector_grant"
  ADD CONSTRAINT "client_connector_grant_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_grant"
  ADD CONSTRAINT "client_connector_grant_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_connector_grant"
  ADD CONSTRAINT "client_connector_grant_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "client_connector_grant" TO freehold_app;
