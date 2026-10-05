-- AlterTable
ALTER TABLE "user"
  ADD COLUMN "signup_ip" TEXT,
  ADD COLUMN "last_sign_in_ip" TEXT,
  ADD COLUMN "last_sign_in_at" TIMESTAMP(3),
  ADD COLUMN "flagged_at" TIMESTAMP(3),
  ADD COLUMN "flag_reason" TEXT,
  ADD COLUMN "flag_token_hash" TEXT,
  ADD COLUMN "flag_cleared_at" TIMESTAMP(3),
  ADD COLUMN "flag_cleared_via" TEXT;

-- Existing accounts: seed last sign-in from their newest session.
UPDATE "user" u
SET last_sign_in_ip = s."ipAddress", last_sign_in_at = s."createdAt"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "ipAddress", "createdAt"
  FROM "session"
  WHERE "ipAddress" IS NOT NULL
  ORDER BY "userId", "createdAt" DESC
) s
WHERE s."userId" = u.id;

CREATE INDEX "user_signup_ip_idx" ON "user"("signup_ip");
CREATE INDEX "user_last_sign_in_ip_idx" ON "user"("last_sign_in_ip");
