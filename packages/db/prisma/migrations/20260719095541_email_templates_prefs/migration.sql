-- AlterTable
ALTER TABLE "client" ADD COLUMN     "email_prefs" JSONB;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "email_templates" JSONB;
