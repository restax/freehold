-- Full send history for an invoice, not just the latest timestamp.
-- Invoice.sent_at only ever holds one moment in time; a second send to a
-- different recipient (the closing attorney, say, after the client) would
-- silently overwrite the record of the first one.
CREATE TABLE "invoice_email_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sent_by_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_email_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_email_log_tenant_id_invoice_id_createdAt_idx" ON "invoice_email_log"("tenant_id", "invoice_id", "createdAt");

ALTER TABLE "invoice_email_log" ADD CONSTRAINT "invoice_email_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_email_log" ADD CONSTRAINT "invoice_email_log_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_email_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_email_log_tenant_isolation ON "invoice_email_log"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_email_log" TO freehold_app;
