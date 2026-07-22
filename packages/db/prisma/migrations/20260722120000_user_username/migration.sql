-- AlterTable
ALTER TABLE "user" ADD COLUMN     "displayUsername" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- Backfill existing users with a subdomain-safe username derived from the email
-- local-part, de-duplicated among users so the unique index holds. These are
-- editable defaults; new signups run the full reserved/slug/username check in
-- the app. NULLs are fine in a unique index, so ordering (index before update)
-- is safe.
WITH cleaned AS (
  SELECT
    id,
    "createdAt",
    COALESCE(
      NULLIF(
        regexp_replace(
          regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9]+', '-', 'g'),
          '^-+|-+$', '', 'g'
        ),
        ''
      ),
      'user'
    ) AS base
  FROM "user"
),
numbered AS (
  SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY "createdAt", id) AS rn
  FROM cleaned
)
UPDATE "user" u
SET "username" = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END,
    "displayUsername" = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE u.id = n.id;

