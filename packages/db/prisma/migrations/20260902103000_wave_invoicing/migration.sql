-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "wave_config" JSONB;

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "external_url" TEXT;
