-- Transaction status becomes the listing lifecycle a coordinator actually
-- works through.
--
-- LISTING was a single bucket for "not under contract yet", which hid the
-- distinctions that change what a TC does that week: a coming-soon listing is
-- waiting on photos, an active one is taking showings, one temporarily off
-- market is paused mid-repair, and a draft isn't real yet. Those are four
-- different conversations, and they were one status.
--
-- LISTING backfills to ACTIVE: it meant "on the market", which is exactly what
-- ACTIVE means now, so no existing file changes meaning.
--
-- Postgres can't drop a value from an enum in place, so the type is rebuilt
-- and the column recast. Only transaction.status uses this type (verified
-- against information_schema), so this is the whole blast radius.

ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";

CREATE TYPE "TransactionStatus" AS ENUM (
  'DRAFT',
  'COMING_SOON',
  'ACTIVE',
  'TMP_OFF_MARKET',
  'UNDER_CONTRACT',
  'PENDING',
  'CLOSED',
  'CANCELLED'
);

-- The default references the old type, so it has to come off before the recast
-- and go back on after.
ALTER TABLE "transaction" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "transaction"
  ALTER COLUMN "status" TYPE "TransactionStatus"
  USING (
    CASE WHEN "status"::text = 'LISTING' THEN 'ACTIVE' ELSE "status"::text END
  )::"TransactionStatus";

ALTER TABLE "transaction" ALTER COLUMN "status" SET DEFAULT 'UNDER_CONTRACT';

DROP TYPE "TransactionStatus_old";
