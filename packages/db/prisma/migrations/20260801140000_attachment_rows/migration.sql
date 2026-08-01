-- Attachments S1: the row becomes the unit, and the file becomes optional.
--
-- Before this, a transaction's Attachments tab was two unrelated lists: a
-- "required documents" checklist (transaction_required_document) that could
-- name a file it was waiting for, and the documents themselves, which the
-- checklist knew nothing about unless somebody hand-linked them. The tab
-- rendered as three cards because it genuinely was three things.
--
-- Now there is one list. Every file gets a row, every expected document gets a
-- row, and a row carries the state that used to have nowhere to live: which
-- folder it belongs in, whether it is required, whether it is done, whether it
-- was ruled not-applicable, and who has signed it.
--
-- The table is renamed rather than recreated so that primary keys, foreign
-- keys, RLS policies and grants all travel with it — a slot that an action
-- plan seeded years ago keeps its identity.

-- 1. Rename the table and its indexes/constraints to match the new model.
ALTER TABLE "transaction_required_document" RENAME TO "transaction_attachment";

ALTER INDEX "transaction_required_document_pkey"
  RENAME TO "transaction_attachment_pkey";
ALTER INDEX "transaction_required_document_tenant_id_idx"
  RENAME TO "transaction_attachment_tenant_id_idx";
ALTER INDEX "transaction_required_document_transaction_id_idx"
  RENAME TO "transaction_attachment_transaction_id_idx";

ALTER TABLE "transaction_attachment"
  RENAME CONSTRAINT "transaction_required_document_tenant_id_fkey"
  TO "transaction_attachment_tenant_id_fkey";
ALTER TABLE "transaction_attachment"
  RENAME CONSTRAINT "transaction_required_document_transaction_id_fkey"
  TO "transaction_attachment_transaction_id_fkey";
ALTER TABLE "transaction_attachment"
  RENAME CONSTRAINT "transaction_required_document_document_id_fkey"
  TO "transaction_attachment_document_id_fkey";

-- The RLS policy travelled with the table but still carries its old name.
ALTER POLICY "transaction_required_document_tenant_isolation"
  ON "transaction_attachment"
  RENAME TO "transaction_attachment_tenant_isolation";

-- 2. Folders. Per-transaction, because which folders a file needs depends on
--    the deal — a workspace-wide list would put a Listing folder on every
--    buy-side file.
CREATE TABLE "attachment_folder" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_folder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attachment_folder_transaction_id_name_key"
  ON "attachment_folder"("transaction_id", "name");
CREATE INDEX "attachment_folder_tenant_id_idx" ON "attachment_folder"("tenant_id");

ALTER TABLE "attachment_folder" ADD CONSTRAINT "attachment_folder_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_folder" ADD CONSTRAINT "attachment_folder_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FORCE as well as ENABLE, matching transaction_attachment: without it the
-- table owner bypasses the policy entirely.
ALTER TABLE "attachment_folder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachment_folder" FORCE ROW LEVEL SECURITY;
CREATE POLICY attachment_folder_tenant_isolation ON "attachment_folder"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attachment_folder" TO freehold_app;

-- 3. The new state a row can carry.
ALTER TABLE "transaction_attachment"
  ADD COLUMN "folder_id" TEXT,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "omitted_at" TIMESTAMP(3),
  ADD COLUMN "omitted_reason" TEXT,
  ADD COLUMN "web_url" TEXT,
  ADD COLUMN "signature_state" JSONB,
  ADD COLUMN "created_by_id" TEXT,
  ADD COLUMN "created_by_name" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "transaction_attachment_folder_id_idx" ON "transaction_attachment"("folder_id");

ALTER TABLE "transaction_attachment" ADD CONSTRAINT "transaction_attachment_folder_id_fkey"
  FOREIGN KEY ("folder_id") REFERENCES "attachment_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Notes on a row. Internal to the workspace — never shown on a portal.
CREATE TABLE "attachment_note" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachment_note_tenant_id_idx" ON "attachment_note"("tenant_id");
CREATE INDEX "attachment_note_attachment_id_idx" ON "attachment_note"("attachment_id");

ALTER TABLE "attachment_note" ADD CONSTRAINT "attachment_note_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachment_note" ADD CONSTRAINT "attachment_note_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "transaction_attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachment_note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachment_note" FORCE ROW LEVEL SECURITY;
CREATE POLICY attachment_note_tenant_isolation ON "attachment_note"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "attachment_note" TO freehold_app;

-- 5. Uploader attribution on the file itself. Denormalised alongside the id
--    (the audit_log pattern) so the row still names who uploaded it after that
--    person leaves and their user row goes.
ALTER TABLE "document"
  ADD COLUMN "uploaded_by_id" TEXT,
  ADD COLUMN "uploaded_by_name" TEXT;

-- 6. Templates can lay out a filing structure, not just a flat list.
ALTER TABLE "attachment_template_item" ADD COLUMN "folder_name" TEXT;

-- 7. Backfill: an existing slot that already holds a file is, by definition,
--    satisfied. Use the document's own upload time rather than now(), so the
--    history reads correctly instead of claiming every old file arrived
--    during this deploy.
UPDATE "transaction_attachment" ta
   SET "completed_at" = d."createdAt"
  FROM "document" d
 WHERE ta."document_id" = d."id"
   AND ta."completed_at" IS NULL;

-- 8. Unification: every current document that nothing points at gets its own
--    row, so the tab can be a single list. These are not required — nobody
--    asked for them, they simply arrived — and they are complete on arrival.
--    Superseded versions are skipped: a version chain is one row, not many.
INSERT INTO "transaction_attachment"
  ("id", "tenant_id", "transaction_id", "label", "document_id",
   "required", "completed_at", "sort_order", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."tenant_id",
  d."transactionId",
  d."filename",
  d."id",
  false,
  d."createdAt",
  COALESCE(base."max_sort", 0)
    + ROW_NUMBER() OVER (PARTITION BY d."transactionId" ORDER BY d."createdAt", d."id"),
  d."createdAt",
  d."createdAt"
FROM "document" d
LEFT JOIN (
  SELECT "transaction_id", MAX("sort_order") AS "max_sort"
    FROM "transaction_attachment"
   GROUP BY "transaction_id"
) base ON base."transaction_id" = d."transactionId"
WHERE d."is_current" = true
  AND NOT EXISTS (
    SELECT 1 FROM "transaction_attachment" ta WHERE ta."document_id" = d."id"
  );
