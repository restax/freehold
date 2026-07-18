-- CreateEnum
CREATE TYPE "EsignProvider" AS ENUM ('MANUAL', 'DOCUMENSO', 'DOCUSIGN');

-- CreateEnum
CREATE TYPE "EnvelopeStatus" AS ENUM ('DRAFT', 'SENT', 'COMPLETED', 'DECLINED', 'ERROR');

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "esign_provider" "EsignProvider";

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "storage_key" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "doc_template" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "body" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_envelope" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "provider" "EsignProvider" NOT NULL,
    "external_id" TEXT,
    "status" "EnvelopeStatus" NOT NULL DEFAULT 'DRAFT',
    "signers" JSONB NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_envelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_template_tenant_id_idx" ON "doc_template"("tenant_id");

-- CreateIndex
CREATE INDEX "signature_envelope_tenant_id_idx" ON "signature_envelope"("tenant_id");

-- CreateIndex
CREATE INDEX "signature_envelope_transactionId_idx" ON "signature_envelope"("transactionId");

-- AddForeignKey
ALTER TABLE "doc_template" ADD CONSTRAINT "doc_template_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelope" ADD CONSTRAINT "signature_envelope_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelope" ADD CONSTRAINT "signature_envelope_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_envelope" ADD CONSTRAINT "signature_envelope_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for Stage 03 tables (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['doc_template','signature_envelope'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
