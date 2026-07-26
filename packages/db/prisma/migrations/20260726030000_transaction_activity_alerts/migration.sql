-- Transaction activity + staleness alerts.
--
-- transaction_activity records the everyday work on a file (task completed,
-- document uploaded, email sent) so we can answer "when was this last touched,
-- by whom, and what did they do". Kept out of audit_log on purpose: that table
-- is the low-volume record of sensitive events and the Settings audit view
-- reads it unfiltered, so routine work would drown it.
--
-- The two new transaction date columns are the critical dates the alert
-- escalation keys off, in priority order after close_date: mortgage
-- commitment, then the inspection deadline.

-- CreateTable
CREATE TABLE "transaction_activity" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The hot lookup is "latest activity for this transaction", read on every
-- dashboard load and every briefing row.
CREATE INDEX "transaction_activity_tenant_id_transaction_id_createdAt_idx"
  ON "transaction_activity"("tenant_id", "transaction_id", "createdAt");

-- AddForeignKey
ALTER TABLE "transaction_activity" ADD CONSTRAINT "transaction_activity_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_activity" ADD CONSTRAINT "transaction_activity_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant isolation (same pattern as every domain table). WITH CHECK pins the
-- inserting side so a row can never be written naming another tenant.
ALTER TABLE "transaction_activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY transaction_activity_tenant_isolation ON "transaction_activity"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_activity" TO freehold_app;

-- AlterTable: critical dates the alert escalation reads.
ALTER TABLE "transaction" ADD COLUMN "mortgage_commitment_date" DATE;
ALTER TABLE "transaction" ADD COLUMN "inspection_deadline_date" DATE;

-- AlterTable: per-client staleness threshold overrides.
ALTER TABLE "client" ADD COLUMN "alert_config" JSONB;
