-- Billing policy + expected fee.
--
-- How each tenant bills is a workspace default (organization.billing_defaults)
-- that every client may override (client.billing_config) — upfront in full or
-- by deposit, per file at entry or at closing, consolidated monthly or weekly,
-- with or without late fees. The expected fee per file is the anchor for the
-- trust surface: a transaction that closes with less billed than expected gets
-- flagged, which is what lets a TC believe they're paid on every file.

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "billing_defaults" JSONB;

-- AlterTable
ALTER TABLE "client" ADD COLUMN "default_fee_cents" INTEGER;
ALTER TABLE "client" ADD COLUMN "billing_config" JSONB;

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN "expected_fee_cents" INTEGER;
