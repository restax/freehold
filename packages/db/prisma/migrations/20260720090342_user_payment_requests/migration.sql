-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('REQUESTED', 'PAID');

-- CreateTable
CREATE TABLE "payment_request" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "paid_by_id" TEXT,
    "paid_note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_item" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "assignee_id" TEXT,
    "transaction_id" TEXT,
    "address" TEXT NOT NULL,
    "fee_cents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_request_tenant_id_idx" ON "payment_request"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_request_tenant_id_user_id_idx" ON "payment_request"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_request_item_assignee_id_key" ON "payment_request_item"("assignee_id");

-- CreateIndex
CREATE INDEX "payment_request_item_tenant_id_idx" ON "payment_request_item"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_request_item_request_id_idx" ON "payment_request_item"("request_id");

-- AddForeignKey
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_item" ADD CONSTRAINT "payment_request_item_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_item" ADD CONSTRAINT "payment_request_item_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "payment_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_item" ADD CONSTRAINT "payment_request_item_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "transaction_assignee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security (same pattern as prior stages).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_request','payment_request_item'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- Local parity with the deploy script, which re-grants every table each deploy.
GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_request" TO freehold_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_request_item" TO freehold_app;
