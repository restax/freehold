-- AlterTable
ALTER TABLE "email_template" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "task_match" TEXT;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "email_settings" JSONB;
