-- AlterTable
ALTER TABLE "member" ADD COLUMN     "calendar_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "member_calendar_token_key" ON "member"("calendar_token");
