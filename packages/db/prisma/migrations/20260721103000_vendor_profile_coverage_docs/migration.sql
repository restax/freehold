-- AlterTable
ALTER TABLE "vendor" ADD COLUMN     "client_bio" TEXT,
ADD COLUMN     "client_phone" TEXT,
ADD COLUMN     "client_service_notes" TEXT,
ADD COLUMN     "private_email" TEXT,
ADD COLUMN     "public_bio" TEXT,
ADD COLUMN     "public_email" TEXT,
ADD COLUMN     "public_phone" TEXT,
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "vendor_coverage" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_document" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA,
    "storage_key" TEXT,
    "storage_provider" TEXT,
    "share_on_order" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_coverage_vendor_id_idx" ON "vendor_coverage"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_coverage_kind_value_idx" ON "vendor_coverage"("kind", "value");

-- CreateIndex
CREATE INDEX "vendor_document_vendor_id_idx" ON "vendor_document"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_slug_key" ON "vendor"("slug");

-- AddForeignKey
ALTER TABLE "vendor_coverage" ADD CONSTRAINT "vendor_coverage_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_document" ADD CONSTRAINT "vendor_document_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- No RLS: both are vendor-owned root tables (no tenant), like vendor itself.
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_coverage" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendor_document" TO freehold_app;
