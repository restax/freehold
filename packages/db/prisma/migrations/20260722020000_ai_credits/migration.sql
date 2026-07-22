-- CreateEnum
CREATE TYPE "CreditLedgerReason" AS ENUM ('PURCHASE', 'COUPON', 'SPEND', 'REFUND', 'ADMIN');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "ai_credits" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "pro_enabled_at" TIMESTAMP(3),
ADD COLUMN     "pro_enabled_by" TEXT,
ADD COLUMN     "pro_features_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditLedgerReason" NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "transaction_id" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_event" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "transaction_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "max_redemptions" INTEGER NOT NULL DEFAULT 1,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_coupon_redemption" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_coupon_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_ledger_tenant_id_createdAt_idx" ON "credit_ledger"("tenant_id", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_event_tenant_id_createdAt_idx" ON "ai_usage_event"("tenant_id", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_event_createdAt_idx" ON "ai_usage_event"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_coupon_code_key" ON "credit_coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_coupon_redemption_coupon_id_tenant_id_key" ON "credit_coupon_redemption"("coupon_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "credit_coupon_redemption" ADD CONSTRAINT "credit_coupon_redemption_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "credit_coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Grandfather: any transaction that already ran a contract extraction keeps its
-- AI on, so nobody loses a feature they were already using when credits land.
UPDATE "transaction" t
SET "pro_features_enabled" = true
WHERE EXISTS (
  SELECT 1 FROM "contract_extraction" e WHERE e."transactionId" = t."id"
);

-- credit_ledger, ai_usage_event, credit_coupon, and credit_coupon_redemption
-- are platform tables (no RLS): operators read them cross-tenant in /admin, and
-- tenant-facing reads always filter by the authenticated tenant id. The app
-- role needs direct access; production also re-grants via vercel-db-setup.mjs.
GRANT SELECT, INSERT, UPDATE, DELETE ON "credit_ledger" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_usage_event" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "credit_coupon" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "credit_coupon_redemption" TO freehold_app;

