-- AlterTable
ALTER TABLE "document" ADD COLUMN     "is_current" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "document_replaces_id_idx" ON "document"("replaces_id");
