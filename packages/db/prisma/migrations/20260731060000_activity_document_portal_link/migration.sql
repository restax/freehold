-- Let an activity row point at the document or portal link it was about, so
-- "emailed to X on Y" can be read off the document/link itself instead of
-- scraped out of the free-text summary.
--
-- SET NULL, not CASCADE: deleting the file shouldn't erase the record that it
-- was once sent to someone. The row keeps its summary and loses only the link.
ALTER TABLE "transaction_activity"
  ADD COLUMN "document_id" TEXT,
  ADD COLUMN "portal_link_id" TEXT;

ALTER TABLE "transaction_activity"
  ADD CONSTRAINT "transaction_activity_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transaction_activity"
  ADD CONSTRAINT "transaction_activity_portal_link_id_fkey"
  FOREIGN KEY ("portal_link_id") REFERENCES "portal_link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "transaction_activity_document_id_idx" ON "transaction_activity"("document_id");
CREATE INDEX "transaction_activity_portal_link_id_idx" ON "transaction_activity"("portal_link_id");
