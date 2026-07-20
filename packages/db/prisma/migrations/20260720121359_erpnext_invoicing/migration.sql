-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'freehold';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "erpnext_config" JSONB;
