-- Client invoicing drops its payment processor. An invoice is now a document,
-- a record, and a follow-up — how the client actually pays (check, Zelle,
-- wire, closing proceeds) is their business. Stripe columns go; numbering,
-- terms, due dates, and the follow-up-task link arrive.

-- DropIndex
DROP INDEX "invoice_stripe_invoice_id_key";

-- New columns first; "number" starts nullable so existing rows can be
-- backfilled before the NOT NULL lands.
ALTER TABLE "invoice"
  DROP COLUMN "hosted_url",
  DROP COLUMN "stripe_invoice_id",
  ADD COLUMN "due_date" DATE,
  ADD COLUMN "follow_up_task_id" TEXT,
  ADD COLUMN "number" INTEGER,
  ADD COLUMN "paid_note" TEXT,
  ADD COLUMN "payment_terms" TEXT,
  ADD COLUMN "sent_at" TIMESTAMP(3);

-- Backfill: sequential per tenant in creation order, so any invoices issued
-- under the old system keep a stable, sensible number.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY "createdAt", id) AS rn
  FROM "invoice"
)
UPDATE "invoice" i SET "number" = numbered.rn FROM numbered WHERE i.id = numbered.id;

ALTER TABLE "invoice" ALTER COLUMN "number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "invoice_tenant_id_number_key" ON "invoice"("tenant_id", "number");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_follow_up_task_id_fkey" FOREIGN KEY ("follow_up_task_id") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
