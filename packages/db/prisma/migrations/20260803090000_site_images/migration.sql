-- Website designer: photographs a workspace uploads for its public site.
--
-- Deliberately not a `document` row. Documents are private transaction files
-- behind authenticated routes; these are public and cached hard. A separate
-- table means the public image route cannot serve a client's contract even if
-- someone later gets a visibility flag wrong.

CREATE TABLE "site_image" (
  "id"               TEXT NOT NULL,
  "tenant_id"        TEXT NOT NULL,
  "filename"         TEXT NOT NULL,
  "content_type"     TEXT NOT NULL,
  "size_bytes"       INTEGER NOT NULL,
  "data"             BYTEA,
  "storage_key"      TEXT,
  "storage_provider" TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "site_image_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_image_tenant_id_idx" ON "site_image"("tenant_id");

ALTER TABLE "site_image"
  ADD CONSTRAINT "site_image_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Same tenant isolation as every other tenant-owned table. The public image
-- route resolves the workspace from the slug in the URL and reads through
-- withTenant(), so serving a public page never means dropping RLS.
ALTER TABLE "site_image" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "site_image" FORCE ROW LEVEL SECURITY;
CREATE POLICY site_image_tenant_isolation ON "site_image"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_image" TO freehold_app;
