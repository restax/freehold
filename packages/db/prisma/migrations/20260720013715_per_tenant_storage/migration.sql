-- AlterTable
ALTER TABLE "document" ADD COLUMN     "storage_provider" TEXT;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "storage_config" JSONB;
