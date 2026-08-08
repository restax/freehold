-- "Time on files": one row per (file, person, day), accrued from presence
-- pings while a transaction page is open. An aggregate ledger, not raw
-- events — enough to answer "what does this file cost" and nothing more.

ALTER TABLE "organization" ADD COLUMN "time_tracking_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "transaction_time_entry" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "touches" INTEGER NOT NULL DEFAULT 0,
    "last_ping_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_time_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transaction_time_entry_transaction_id_user_id_day_key"
  ON "transaction_time_entry"("transaction_id", "user_id", "day");
CREATE INDEX "transaction_time_entry_tenant_id_day_idx"
  ON "transaction_time_entry"("tenant_id", "day");
CREATE INDEX "transaction_time_entry_tenant_id_transaction_id_idx"
  ON "transaction_time_entry"("tenant_id", "transaction_id");

ALTER TABLE "transaction_time_entry"
  ADD CONSTRAINT "transaction_time_entry_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_time_entry"
  ADD CONSTRAINT "transaction_time_entry_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_time_entry"
  ADD CONSTRAINT "transaction_time_entry_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Same tenant isolation as every other tenant-owned table, WITH CHECK pinned
-- to the inserting side so a tenant can't write rows naming another tenant.
ALTER TABLE "transaction_time_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_time_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY transaction_time_entry_tenant_isolation ON "transaction_time_entry"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_time_entry" TO freehold_app;
