-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('RUNNING', 'READY', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "FieldConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FieldTarget" AS ENUM ('TRANSACTION_FIELD', 'TASK', 'CUSTOM_FIELD');

-- CreateEnum
CREATE TYPE "FieldValueType" AS ENUM ('TEXT', 'DATE', 'MONEY');

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_extraction" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'RUNNING',
    "model" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_extraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_field" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "FieldValueType" NOT NULL DEFAULT 'TEXT',
    "page" INTEGER,
    "quote" TEXT,
    "confidence" "FieldConfidence" NOT NULL DEFAULT 'MEDIUM',
    "target" "FieldTarget" NOT NULL DEFAULT 'CUSTOM_FIELD',
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "extraction_field_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_tenant_id_idx" ON "document"("tenant_id");

-- CreateIndex
CREATE INDEX "document_transactionId_idx" ON "document"("transactionId");

-- CreateIndex
CREATE INDEX "contract_extraction_tenant_id_idx" ON "contract_extraction"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_extraction_transactionId_idx" ON "contract_extraction"("transactionId");

-- CreateIndex
CREATE INDEX "extraction_field_tenant_id_idx" ON "extraction_field"("tenant_id");

-- CreateIndex
CREATE INDEX "extraction_field_extractionId_idx" ON "extraction_field"("extractionId");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction" ADD CONSTRAINT "contract_extraction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction" ADD CONSTRAINT "contract_extraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_extraction" ADD CONSTRAINT "contract_extraction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_field" ADD CONSTRAINT "extraction_field_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_field" ADD CONSTRAINT "extraction_field_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "contract_extraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for Stage 02 tables (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document','contract_extraction','extraction_field'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
