-- Freehold as an OAuth authorization server, so Claude (and any other MCP
-- client) can connect a workspace without a human handling a raw API key.
--
-- Three tables, all owned by Better Auth's mcp plugin. Column names are fixed
-- by that plugin's adapter and must not be renamed.
--
-- Deliberately NO row-level security, for the same reason api_key and
-- portal_link have none: the bearer token IS the capability and has to be
-- resolved before any tenant context exists. Authority is decided per tool
-- call from the live member row, not frozen into the token at mint time —
-- which is what makes revoking someone's access take effect immediately
-- rather than whenever their token happens to expire.

CREATE TABLE "oauth_application" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "icon"          TEXT,
  "metadata"      TEXT,
  "client_id"     TEXT NOT NULL,
  "client_secret" TEXT,
  "redirect_urls" TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "disabled"      BOOLEAN DEFAULT false,
  -- Null for clients created by Dynamic Client Registration: Claude registers
  -- before anyone has logged in, so the user is bound at consent instead.
  "user_id"       TEXT REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at"    TIMESTAMP(3) NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "oauth_application_client_id_key" ON "oauth_application"("client_id");
CREATE INDEX "oauth_application_user_id_idx" ON "oauth_application"("user_id");

-- One live connection between a client and a user. Deleting a row here is
-- what actually cuts Claude off, so the Settings page's revoke button and the
-- workspace kill switch both land on this table.
CREATE TABLE "oauth_access_token" (
  "id"                        TEXT PRIMARY KEY,
  "access_token"              TEXT NOT NULL,
  "refresh_token"             TEXT NOT NULL,
  "access_token_expires_at"   TIMESTAMP(3) NOT NULL,
  "refresh_token_expires_at"  TIMESTAMP(3) NOT NULL,
  "client_id"                 TEXT NOT NULL
                                REFERENCES "oauth_application"("client_id") ON DELETE CASCADE,
  "user_id"                   TEXT REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes"                    TEXT NOT NULL,
  "created_at"                TIMESTAMP(3) NOT NULL,
  "updated_at"                TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "oauth_access_token_access_token_key" ON "oauth_access_token"("access_token");
CREATE UNIQUE INDEX "oauth_access_token_refresh_token_key" ON "oauth_access_token"("refresh_token");
CREATE INDEX "oauth_access_token_client_id_idx" ON "oauth_access_token"("client_id");
CREATE INDEX "oauth_access_token_user_id_idx" ON "oauth_access_token"("user_id");

-- Remembers an approval so reconnecting the same client doesn't re-prompt.
CREATE TABLE "oauth_consent" (
  "id"            TEXT PRIMARY KEY,
  "client_id"     TEXT NOT NULL
                    REFERENCES "oauth_application"("client_id") ON DELETE CASCADE,
  "user_id"       TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scopes"        TEXT NOT NULL,
  "consent_given" BOOLEAN NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL
);

CREATE INDEX "oauth_consent_client_id_idx" ON "oauth_consent"("client_id");
CREATE INDEX "oauth_consent_user_id_idx" ON "oauth_consent"("user_id");

-- Which workspace a Claude connection speaks for.
--
-- An OAuth token identifies a person, and a coordinator can belong to several
-- workspaces, so the token alone doesn't say whose files Claude may read. The
-- consent screen asks and the answer lands here.
--
-- No RLS, for the same reason as api_key: this row is resolved *before* any
-- tenant context exists, because resolving it is what establishes the tenant.
-- Reads are keyed on the user id the bearer token proved.
--
-- client_id is intentionally not a foreign key to oauth_application. Dynamic
-- Client Registration rows get pruned once no live token references them, and
-- that cleanup must not cascade away the record of who connected what.
CREATE TABLE "mcp_connection" (
  "id"           TEXT PRIMARY KEY,
  "tenant_id"    TEXT NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "user_id"      TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "client_id"    TEXT NOT NULL,
  "client_name"  TEXT NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  -- Set rather than deleted: "Claude had access between these dates" is the
  -- question asked after the fact, and a deleted row cannot answer it.
  "revoked_at"   TIMESTAMP(3)
);

CREATE UNIQUE INDEX "mcp_connection_user_id_client_id_key"
  ON "mcp_connection"("user_id", "client_id");
CREATE INDEX "mcp_connection_tenant_id_idx" ON "mcp_connection"("tenant_id");
