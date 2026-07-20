-- Unlimited per-transaction assignment: TransactionAssignee replaces the fixed
-- tc1/tc2 slots. Existing values are carried over BEFORE the columns drop.

-- CreateTable
CREATE TABLE "transaction_assignee" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_label" TEXT,
    "fee_cents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_assignee_tenant_id_idx" ON "transaction_assignee"("tenant_id");
CREATE INDEX "transaction_assignee_tenant_id_user_id_idx" ON "transaction_assignee"("tenant_id", "user_id");
CREATE UNIQUE INDEX "transaction_assignee_transaction_id_user_id_key" ON "transaction_assignee"("transaction_id", "user_id");

-- AddForeignKey
ALTER TABLE "transaction_assignee" ADD CONSTRAINT "transaction_assignee_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_assignee" ADD CONSTRAINT "transaction_assignee_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_assignee" ADD CONSTRAINT "transaction_assignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every tc1/tc2 value becomes an assignee row (skipping dangling
-- user ids and the duplicate case where tc1 = tc2).
INSERT INTO "transaction_assignee" ("id", "tenant_id", "transaction_id", "user_id", "role_label")
SELECT gen_random_uuid(), t."tenant_id", t."id", t."tc1_user_id", 'TC / assistant'
FROM "transaction" t
JOIN "user" u ON u."id" = t."tc1_user_id"
WHERE t."tc1_user_id" IS NOT NULL
ON CONFLICT ("transaction_id", "user_id") DO NOTHING;

INSERT INTO "transaction_assignee" ("id", "tenant_id", "transaction_id", "user_id", "role_label")
SELECT gen_random_uuid(), t."tenant_id", t."id", t."tc2_user_id", 'TC / assistant'
FROM "transaction" t
JOIN "user" u ON u."id" = t."tc2_user_id"
WHERE t."tc2_user_id" IS NOT NULL
ON CONFLICT ("transaction_id", "user_id") DO NOTHING;

-- Only now is it safe to drop the old slots.
ALTER TABLE "transaction" DROP COLUMN "tc1_user_id",
DROP COLUMN "tc2_user_id";

-- Row-level security (same pattern as prior stages).
DO $$
BEGIN
  EXECUTE 'ALTER TABLE transaction_assignee ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE transaction_assignee FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY transaction_assignee_tenant_isolation ON transaction_assignee USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))';
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_assignee" TO freehold_app;
