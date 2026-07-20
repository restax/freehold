-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "voice_quota_reset_at" TIMESTAMP(3),
ADD COLUMN     "voice_sessions_used" INTEGER NOT NULL DEFAULT 0;
