-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateTable
CREATE TABLE "email" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transactionId" TEXT,
    "contact_id" TEXT,
    "direction" "EmailDirection" NOT NULL,
    "from_addr" TEXT NOT NULL,
    "to_addr" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "reply_token" TEXT,
    "provider_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_tenant_id_transactionId_createdAt_idx" ON "email"("tenant_id", "transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "email_reply_token_idx" ON "email"("reply_token");

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email" ADD CONSTRAINT "email_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_tenant_isolation ON "email"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "email" TO freehold_app;
