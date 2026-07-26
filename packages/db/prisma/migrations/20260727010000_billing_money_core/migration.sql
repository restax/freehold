-- Billing money core: invoice line items, an append-only payments ledger, and
-- a client credit (on-account/retainer) ledger.
--
-- Design rules this migration bakes in:
--   * Ledgers are append-only. A bounced check is a reversal entry pointing at
--     the original, never an edit — the books always show what happened.
--   * invoice.amount_cents stays as the denormalized total (sum of lines),
--     maintained by the single writer in the app, so list queries and the
--     ERPNext mirror never join lines for a total.
--   * Backfill makes the ledger true for history: every existing invoice gets
--     its one line; every already-PAID Freehold-provider invoice gets a
--     synthesized payment entry, so total - payments = 0 holds. ERPNext-
--     provider invoices are deliberately NOT given ledger rows — their ERP is
--     the record and Freehold only mirrors status.

-- New lifecycle state for invoices being assembled (scheduled billing drafts,
-- multi-line invoices built before issuing). PG16 allows ADD VALUE in a
-- transaction as long as the value isn't used in the same migration.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- CreateTable: invoice_line
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'service',
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_line_tenant_id_invoice_id_idx" ON "invoice_line"("tenant_id", "invoice_id");
CREATE INDEX "invoice_line_tenant_id_transaction_id_idx" ON "invoice_line"("tenant_id", "transaction_id");

ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: client_credit_entry (before invoice_payment, which references it)
CREATE TABLE "client_credit_entry" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "invoice_id" TEXT,
    "recorded_by_name" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_credit_entry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_credit_entry_tenant_id_client_id_idx" ON "client_credit_entry"("tenant_id", "client_id");

ALTER TABLE "client_credit_entry" ADD CONSTRAINT "client_credit_entry_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_credit_entry" ADD CONSTRAINT "client_credit_entry_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_credit_entry" ADD CONSTRAINT "client_credit_entry_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: invoice_payment
CREATE TABLE "invoice_payment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "credit_entry_id" TEXT,
    "reverses_id" TEXT,
    "recorded_by_name" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_payment_credit_entry_id_key" ON "invoice_payment"("credit_entry_id");
CREATE INDEX "invoice_payment_tenant_id_invoice_id_idx" ON "invoice_payment"("tenant_id", "invoice_id");

ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_credit_entry_id_fkey"
  FOREIGN KEY ("credit_entry_id") REFERENCES "client_credit_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_reverses_id_fkey"
  FOREIGN KEY ("reverses_id") REFERENCES "invoice_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant isolation on all three (WITH CHECK pins the inserting side).
ALTER TABLE "invoice_line" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_line_tenant_isolation ON "invoice_line"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_line" TO freehold_app;

ALTER TABLE "client_credit_entry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_credit_entry_tenant_isolation ON "client_credit_entry"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "client_credit_entry" TO freehold_app;

ALTER TABLE "invoice_payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_payment_tenant_isolation ON "invoice_payment"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_payment" TO freehold_app;

-- Backfill: every existing invoice becomes a one-line invoice.
INSERT INTO "invoice_line" ("id", "tenant_id", "invoice_id", "kind", "description", "amount_cents", "sort_order", "createdAt")
SELECT gen_random_uuid(), "tenant_id", "id", 'service', "description", "amount_cents", 0, "createdAt"
FROM "invoice";

-- Backfill: already-PAID Freehold invoices get their payment on the ledger so
-- balance math (total - payments = 0) is true for history, not just new rows.
INSERT INTO "invoice_payment" ("id", "tenant_id", "invoice_id", "amount_cents", "note", "source", "received_at", "createdAt")
SELECT gen_random_uuid(), "tenant_id", "id", "amount_cents",
       COALESCE("paid_note", 'Recorded before the payment ledger existed'),
       'direct', COALESCE("paid_at", "createdAt"), COALESCE("paid_at", "createdAt")
FROM "invoice"
WHERE "status" = 'PAID' AND "provider" = 'freehold';
