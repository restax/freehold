-- Public form submissions: uploaded files, and the hash used to rate-limit
-- them.
--
--   * Files land here, NOT in "document". A document belongs to a
--     transaction and shows up in the workspace's library; nothing a
--     stranger uploads should appear there before a person has reviewed it.
--     Conversion (stage 5) promotes these into real documents on the new
--     transaction; otherwise they die with the submission.
--   * ip_hash is a per-tenant salted hash, never a raw address: it exists
--     only to count recent submissions from one source.

ALTER TABLE "form_submission" ADD COLUMN "ip_hash" TEXT;
CREATE INDEX "form_submission_tenant_id_ip_hash_createdAt_idx"
  ON "form_submission"("tenant_id", "ip_hash", "createdAt");

CREATE TABLE "form_submission_file" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA,
    "storage_key" TEXT,
    "storage_provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submission_file_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_submission_file_tenant_id_submission_id_idx"
  ON "form_submission_file"("tenant_id", "submission_id");

ALTER TABLE "form_submission_file" ADD CONSTRAINT "form_submission_file_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "form_submission_file" ADD CONSTRAINT "form_submission_file_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "form_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submission_file" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_submission_file_tenant_isolation ON "form_submission_file"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_submission_file" TO freehold_app;
