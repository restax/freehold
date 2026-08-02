-- OpenSign: a third e-sign provider, centrally hosted by Freehold rather than
-- BYO like Documenso/DocuSign. Each tenant gets its own isolated org inside
-- one shared OpenSign instance, provisioned automatically on first use.

-- AlterEnum
ALTER TYPE "EsignProvider" ADD VALUE IF NOT EXISTS 'OPENSIGN';

-- Per-tenant OpenSign org + encrypted session token, same shape as
-- documenso_config but auto-provisioned rather than user-entered.
ALTER TABLE "organization"
  ADD COLUMN "opensign_config" JSONB;

-- The signed copy that comes back from an envelope's webhook becomes a new
-- Document version; this points the new row at the envelope that produced it.
-- One envelope produces at most one signed copy, hence unique.
ALTER TABLE "document"
  ADD COLUMN "source_envelope_id" TEXT;

CREATE UNIQUE INDEX "document_source_envelope_id_key" ON "document"("source_envelope_id");

ALTER TABLE "document"
  ADD CONSTRAINT "document_source_envelope_id_fkey"
  FOREIGN KEY ("source_envelope_id") REFERENCES "signature_envelope"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
