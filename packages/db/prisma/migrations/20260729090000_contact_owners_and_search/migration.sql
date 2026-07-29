-- Two changes to how a contact is found and who it belongs to.
--
-- 1. Contact ownership becomes many-to-many. A single owner column forced a
--    choice that isn't real: a file gets covered, someone goes on holiday, two
--    coordinators share a brokerage. The join table says what's true instead
--    of making one of them wrong.
--
-- 2. secondary_search indexes the second person on a record. Half a workspace's
--    contacts come with an assistant or a spouse, and people look them up by
--    name and address constantly. Their details live in a JSON blob, where a
--    case-insensitive match means scanning every row — so their searchable
--    text is denormalised into one lowercase column with an index on it.

CREATE TABLE "contact_owner" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_owner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_owner_tenant_id_idx" ON "contact_owner"("tenant_id");
CREATE INDEX "contact_owner_user_id_idx" ON "contact_owner"("user_id");
CREATE UNIQUE INDEX "contact_owner_contact_id_user_id_key"
  ON "contact_owner"("contact_id", "user_id");

ALTER TABLE "contact_owner" ADD CONSTRAINT "contact_owner_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_owner" ADD CONSTRAINT "contact_owner_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_owner" ADD CONSTRAINT "contact_owner_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry every existing owner across before the column goes.
INSERT INTO "contact_owner" ("id", "tenant_id", "contact_id", "user_id")
SELECT gen_random_uuid()::text, c."tenant_id", c."id", c."ownerId"
FROM "contact" c
WHERE c."ownerId" IS NOT NULL;

ALTER TABLE "contact" DROP COLUMN "ownerId";

-- Row-level security (same pattern as prior stages).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE contact_owner ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE contact_owner FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY contact_owner_tenant_isolation ON contact_owner USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "contact_owner" TO freehold_app;

-- The second person's searchable text, lowercased and indexed.
ALTER TABLE "contact" ADD COLUMN "secondary_search" TEXT;

UPDATE "contact" SET "secondary_search" = NULLIF(
  lower(
    trim(
      concat_ws(' ',
        NULLIF("secondary"->>'first', ''),
        NULLIF("secondary"->>'last', ''),
        NULLIF("secondary"->>'email', '')
      )
    )
  ),
  ''
)
WHERE "secondary" IS NOT NULL;

CREATE INDEX "contact_secondary_search_idx" ON "contact"("secondary_search");
