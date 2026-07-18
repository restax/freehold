-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('SENT', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clientId" TEXT,
    "transactionId" TEXT,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'SENT',
    "stripe_invoice_id" TEXT,
    "hosted_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_stripe_invoice_id_key" ON "invoice"("stripe_invoice_id");

-- CreateIndex
CREATE INDEX "invoice_tenant_id_idx" ON "invoice"("tenant_id");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_tenant_isolation ON "invoice"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice" TO freehold_app;
